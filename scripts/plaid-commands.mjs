import crypto from 'node:crypto';
import { getAppConnectionString, withClient } from './db-utils.mjs';
import { syncImportedAccount } from './account-commands.mjs';
import {
  getMockState,
  isMockDatabaseEnabled,
  upsertMockPlaidBill,
  upsertMockPlaidDebt,
} from './mock-db.mjs';
import {
  buildPlaidAccountPreview,
  buildPlaidTransactionPreview,
  normalizePlaidBalance,
} from '../src/lib/plaid.js';
import {
  buildPlaidLiabilityBillRow,
  buildPlaidLiabilityDebtRow,
  buildPlaidLiabilitySnapshot,
} from '../src/lib/liabilities.js';
import { formatTransactionDayLabel } from '../src/lib/transaction-date.js';

const PLAID_BASE_URLS = {
  sandbox: 'https://sandbox.plaid.com',
  development: 'https://development.plaid.com',
  production: 'https://production.plaid.com',
};

const PLAID_WEBHOOK_KEY_CACHE = new Map();
const PLAID_WEBHOOK_TTL_SECONDS = 300;
const PLAID_TRANSACTION_WEBHOOKS = new Set([
  'INITIAL_UPDATE',
  'HISTORICAL_UPDATE',
  'DEFAULT_UPDATE',
  'SYNC_UPDATES_AVAILABLE',
]);
const PLAID_ITEM_ERROR_STATUSES = new Map([
  ['ERROR', 'error'],
  ['LOGIN_REPAIRED', 'synced'],
  ['NEW_ACCOUNTS_AVAILABLE', 'review'],
  ['PENDING_DISCONNECT', 'warning'],
  ['PENDING_EXPIRATION', 'warning'],
  ['USER_PERMISSION_REVOKED', 'error'],
]);

function getPlaidBaseUrl(env = process.env.PLAID_ENV || 'sandbox') {
  return PLAID_BASE_URLS[String(env || 'sandbox').toLowerCase()] || PLAID_BASE_URLS.sandbox;
}

function getPlaidCredentials() {
  const clientId = String(process.env.PLAID_CLIENT_ID || '').trim();
  const secret = String(process.env.PLAID_SECRET || '').trim();

  if (!clientId) {
    throw new Error('PLAID_CLIENT_ID is required');
  }

  if (!secret) {
    throw new Error('PLAID_SECRET is required');
  }

  return { clientId, secret };
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const normalized = String(value || '').replaceAll('-', '+').replaceAll('_', '/');
  const padded = `${normalized}${'='.repeat((4 - (normalized.length % 4)) % 4)}`;
  return Buffer.from(padded, 'base64');
}

function parseJwtParts(token) {
  const parts = String(token || '').split('.');

  if (parts.length !== 3) {
    throw new Error('Invalid Plaid verification token');
  }

  const header = JSON.parse(base64UrlDecode(parts[0]).toString('utf8'));
  const payload = JSON.parse(base64UrlDecode(parts[1]).toString('utf8'));

  return { header, payload, signingInput: `${parts[0]}.${parts[1]}`, signature: base64UrlDecode(parts[2]) };
}

function rawEs256SignatureToDer(signature) {
  const raw = Buffer.from(signature);

  if (raw.length !== 64) {
    throw new Error('Invalid ES256 signature');
  }

  const trimInteger = (bytes) => {
    let index = 0;
    while (index < bytes.length - 1 && bytes[index] === 0) {
      index += 1;
    }

    let result = bytes.slice(index);
    if (result[0] & 0x80) {
      result = Buffer.concat([Buffer.from([0]), result]);
    }

    return result;
  };

  const r = trimInteger(raw.subarray(0, 32));
  const s = trimInteger(raw.subarray(32));
  const totalLength = 2 + r.length + 2 + s.length;

  return Buffer.concat([
    Buffer.from([0x30, totalLength, 0x02, r.length]),
    r,
    Buffer.from([0x02, s.length]),
    s,
  ]);
}

function formatPlaidItemStatus(webhookType, webhookCode) {
  if (webhookType === 'TRANSACTIONS' && PLAID_TRANSACTION_WEBHOOKS.has(webhookCode)) {
    return 'synced';
  }

  return PLAID_ITEM_ERROR_STATUSES.get(webhookCode) || 'synced';
}

async function getPlaidWebhookVerificationKey({ keyId, env, fetchImpl, clientId, secret }) {
  const cacheKey = `${String(env || 'sandbox').toLowerCase()}:${keyId}`;
  const cached = PLAID_WEBHOOK_KEY_CACHE.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.key;
  }

  const response = await plaidRequest(
    '/webhook_verification_key/get',
    { key_id: keyId },
    { fetchImpl, env, clientId, secret },
  );

  PLAID_WEBHOOK_KEY_CACHE.set(cacheKey, {
    key: response.key,
    expiresAt: Date.now() + (60 * 60 * 1000),
  });

  return response.key;
}

async function updatePlaidItemSyncStatus(client, {
  householdId = 1,
  provider = 'plaid',
  itemId,
  syncStatus,
}) {
  const normalizedStatus = syncStatus || 'synced';

  if (isMockDatabaseEnabled()) {
    const state = getMockState();
    const item = state.plaidItems.find((row) => (
      row.household_id === householdId
      && row.provider === provider
      && row.item_id === itemId
    ));

    if (!item) {
      return null;
    }

    item.sync_status = normalizedStatus;
    item.updated_at = new Date().toISOString();

    for (const account of state.accounts) {
      if (
        account.household_id === householdId
        && account.external_provider === provider
        && account.external_item_id === itemId
      ) {
        account.sync_status = normalizedStatus;
      }
    }

    return {
      id: item.id,
      itemId: item.item_id,
      syncStatus: item.sync_status,
    };
  }

  const result = await client.query(
    `
      update plaid_items
      set sync_status = $1, updated_at = now()
      where household_id = $2
        and provider = $3
        and item_id = $4
      returning id, item_id, sync_status
    `,
    [normalizedStatus, householdId, provider, itemId],
  );

  if (!result.rowCount) {
    return null;
  }

  await client.query(
    `
      update accounts
      set sync_status = $1
      where household_id = $2
        and external_provider = $3
        and external_item_id = $4
    `,
    [normalizedStatus, householdId, provider, itemId],
  );

  return {
    id: result.rows[0].id,
    itemId: result.rows[0].item_id,
    syncStatus: result.rows[0].sync_status,
  };
}

export async function verifyPlaidWebhook({
  body,
  signedWebhook,
  env,
  fetchImpl,
} = {}) {
  const token = String(signedWebhook || '').trim();

  if (!token) {
    throw new Error('Plaid verification header is required');
  }

  const { clientId, secret } = getPlaidCredentials();
  const { header, payload, signingInput, signature } = parseJwtParts(token);

  if (header.alg !== 'ES256') {
    throw new Error('Unsupported Plaid verification algorithm');
  }

  const key = await getPlaidWebhookVerificationKey({
    keyId: header.kid,
    env,
    fetchImpl,
    clientId,
    secret,
  });

  const publicKey = crypto.createPublicKey({ key, format: 'jwk' });
  const verified = crypto.verify(
    'sha256',
    Buffer.from(signingInput),
    publicKey,
    rawEs256SignatureToDer(signature),
  );

  if (!verified) {
    throw new Error('Plaid webhook signature verification failed');
  }

  const iat = Number(payload.iat);
  if (!Number.isFinite(iat) || (Date.now() / 1000) - iat > PLAID_WEBHOOK_TTL_SECONDS) {
    throw new Error('Plaid webhook is too old');
  }

  const bodyHash = crypto.createHash('sha256').update(String(body || '')).digest('hex');
  const claimedBodyHash = String(payload.request_body_sha256 || '');

  if (
    bodyHash.length !== claimedBodyHash.length
    || !crypto.timingSafeEqual(Buffer.from(bodyHash), Buffer.from(claimedBodyHash))
  ) {
    throw new Error('Plaid webhook body hash mismatch');
  }

  return payload;
}

export async function handlePlaidWebhook({
  body,
  signedWebhook,
  householdId = 1,
  env,
  fetchImpl,
} = {}) {
  await verifyPlaidWebhook({
    body,
    signedWebhook,
    env,
    fetchImpl,
  });

  const event = JSON.parse(String(body || '{}'));
  const webhookType = String(event.webhook_type || '').toUpperCase();
  const webhookCode = String(event.webhook_code || '').toUpperCase();
  const itemId = String(event.item_id || '').trim();

  if (webhookType === 'TRANSACTIONS' && PLAID_TRANSACTION_WEBHOOKS.has(webhookCode) && itemId) {
    const syncResult = await syncPlaidData({
      householdId,
      itemId,
      env,
      fetchImpl,
    });

    return {
      verified: true,
      webhookType,
      webhookCode,
      itemId,
      action: 'synced',
      ...syncResult,
    };
  }

  if (webhookType === 'LIABILITIES' && webhookCode === 'DEFAULT_UPDATE' && itemId) {
    const syncResult = await syncPlaidLiabilities({
      householdId,
      itemId,
      env,
      fetchImpl,
    });

    return {
      verified: true,
      webhookType,
      webhookCode,
      itemId,
      action: 'synced',
      ...syncResult,
    };
  }

  if (webhookType === 'ITEM' && itemId) {
    const nextStatus = formatPlaidItemStatus(webhookType, webhookCode);

    if (webhookCode === 'LOGIN_REPAIRED') {
      await syncPlaidData({
        householdId,
        itemId,
        env,
        fetchImpl,
      });
    }

    await withClient(getAppConnectionString(), async (client) => {
      await updatePlaidItemSyncStatus(client, {
        householdId,
        itemId,
        syncStatus: nextStatus,
      });
    });

    return {
      verified: true,
      webhookType,
      webhookCode,
      itemId,
      action: nextStatus,
    };
  }

  return {
    verified: true,
    webhookType,
    webhookCode,
    itemId,
    action: 'ignored',
  };
}

async function plaidRequest(path, body, { fetchImpl = globalThis.fetch, env, clientId, secret } = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch is not available');
  }

  const response = await fetchImpl(`${getPlaidBaseUrl(env)}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      secret,
      ...body,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error_message || payload?.error || `Plaid request failed for ${path}`);
  }

  if (payload?.error_code) {
    throw new Error(payload.error_message || payload.error_code);
  }

  return payload;
}

async function upsertPlaidItem(client, input) {
  const result = await client.query(
    `
      insert into plaid_items (
        household_id,
        provider,
        item_id,
        access_token,
        institution_name,
        link_session_id,
        transaction_cursor,
        sync_status,
        updated_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, now())
      on conflict (household_id, provider, item_id)
      do update set
        access_token = excluded.access_token,
        institution_name = excluded.institution_name,
        link_session_id = excluded.link_session_id,
        sync_status = excluded.sync_status,
        updated_at = excluded.updated_at
      returning id, household_id, provider, item_id, institution_name, link_session_id, transaction_cursor, sync_status
    `,
    [
      input.householdId,
      input.provider || 'plaid',
      input.itemId,
      input.accessToken,
      input.institutionName || null,
      input.linkSessionId || null,
      input.transactionCursor || null,
      input.syncStatus || 'linked',
    ],
  );

  return result.rows[0];
}

async function fetchPlaidItems(client, { householdId, provider = 'plaid', itemId = null }) {
  const params = [householdId, provider];
  const filters = ['household_id = $1', 'provider = $2'];

  if (itemId) {
    params.push(itemId);
    filters.push(`item_id = $${params.length}`);
  }

  const result = await client.query(
    `
      select id, household_id, provider, item_id, access_token, institution_name, link_session_id, transaction_cursor, sync_status
      from plaid_items
      where ${filters.join(' and ')}
      order by id
    `,
    params,
  );

  return result.rows;
}

async function fetchPlaidItem(client, { householdId, provider = 'plaid', itemId }) {
  const items = await fetchPlaidItems(client, { householdId, provider, itemId });
  return items[0] || null;
}

async function fetchPlaidImportedAccountIds(client, { householdId, provider = 'plaid', itemId }) {
  const result = await client.query(
    `
      select external_account_id, owner_member_id
      from accounts
      where household_id = $1
        and external_provider = $2
        and external_item_id = $3
      order by id
    `,
    [householdId, provider, itemId],
  );

  return result.rows;
}

async function fetchHouseholdMembers(client, householdId) {
  const result = await client.query(
    `
      select id, slug
      from household_members
      where household_id = $1
      order by id
    `,
    [householdId],
  );

  return result.rows;
}

function normalizePlaidTransactionCursor(cursor) {
  const value = String(cursor || '').trim();
  return value || null;
}

function getImportedAccountOwnerMap(existingAccounts = []) {
  const ownerMap = new Map();

  for (const account of existingAccounts) {
    const accountId = String(account.external_account_id || account.externalAccountId || '');
    const ownerMemberId = Number(account.owner_member_id || account.ownerMemberId || 0);

    if (accountId) {
      ownerMap.set(accountId, ownerMemberId || null);
    }
  }

  return ownerMap;
}

function getHouseholdMemberSlugMap(householdMembers = []) {
  const map = new Map();

  for (const member of householdMembers) {
    map.set(Number(member.id), member.slug);
  }

  return map;
}

function getImportedAccountOwnerSlug(accountId, accountOwnerMap, householdMemberSlugMap, fallbackOwnerSlug = 'john') {
  const ownerMemberId = accountOwnerMap.get(String(accountId || ''));

  if (ownerMemberId && householdMemberSlugMap.has(ownerMemberId)) {
    return householdMemberSlugMap.get(ownerMemberId);
  }

  return fallbackOwnerSlug;
}

function getTransactionOwnerSlug(transaction, accountOwnerMap, householdMemberSlugMap, fallbackOwnerSlug = 'john') {
  const ownerMemberId = accountOwnerMap.get(String(transaction.account_id || ''));
  if (ownerMemberId && householdMemberSlugMap.has(ownerMemberId)) {
    return householdMemberSlugMap.get(ownerMemberId);
  }

  return fallbackOwnerSlug;
}

function buildPlaidImportedTransaction(transaction, { ownerSlug = 'john', syncStatus = null } = {}) {
  const preview = buildPlaidTransactionPreview({
    transaction,
    accountOwnerSlug: ownerSlug,
  });

  return {
    ...preview,
    syncStatus: syncStatus || preview.syncStatus,
    importedAt: new Date().toISOString(),
  };
}

async function deletePlaidTransactionByExternalId(client, { householdId, provider = 'plaid', transactionId }) {
  if (isMockDatabaseEnabled()) {
    const state = getMockState();
    const index = state.transactions.findIndex((row) => (
      row.household_id === householdId
      && row.external_provider === provider
      && row.external_transaction_id === transactionId
    ));

    if (index < 0) {
      return 0;
    }

    state.transactions.splice(index, 1);
    return 1;
  }

  const result = await client.query(
    `
      delete from transactions
      where household_id = $1
        and external_provider = $2
        and external_transaction_id = $3
    `,
    [householdId, provider, transactionId],
  );

  return result.rowCount || 0;
}

function upsertMockPlaidTransactionFromPreview(state, householdId, provider, preview) {
  const existing = state.transactions.find((row) => (
    row.household_id === householdId
    && row.external_provider === provider
    && row.external_transaction_id === preview.externalTransactionId
  ));

  if (existing) {
    existing.member_id = state.members.find((member) => member.slug === preview.memberSlug)?.id ?? existing.member_id;
    existing.posted_date = preview.postedDate;
    existing.posted_label = formatTransactionDayLabel(preview.postedDate, state.household.as_of);
    existing.merchant = preview.merchant;
    existing.category = preview.category;
    existing.amount = preview.amount;
    existing.time_label = preview.timeLabel || null;
    existing.emoji = preview.emoji;
    existing.is_income = preview.isIncome;
    existing.external_item_id = preview.externalItemId;
    existing.external_account_id = preview.externalAccountId;
    existing.imported_at = preview.importedAt;
    existing.sync_status = preview.syncStatus;
    return { rowCount: 1, row: existing };
  }

  const row = {
    id: state.nextIds.transaction++,
    household_id: householdId,
    member_id: state.members.find((member) => member.slug === preview.memberSlug)?.id ?? null,
    posted_date: preview.postedDate,
    posted_label: formatTransactionDayLabel(preview.postedDate, state.household.as_of),
    merchant: preview.merchant,
    category: preview.category,
    amount: preview.amount,
    time_label: preview.timeLabel || null,
    emoji: preview.emoji,
    is_income: preview.isIncome,
    sort_order: (state.transactions.reduce((max, item) => Math.max(max, Number(item.sort_order) || 0), -1) + 1),
    external_provider: provider,
    external_item_id: preview.externalItemId,
    external_account_id: preview.externalAccountId,
    external_transaction_id: preview.externalTransactionId,
    imported_at: preview.importedAt,
    sync_status: preview.syncStatus,
  };

  state.transactions.push(row);
  return { rowCount: 1, row };
}

function normalizePlaidTransactionPage(response) {
  return {
    added: response.added || [],
    modified: response.modified || [],
    removed: response.removed || [],
    nextCursor: normalizePlaidTransactionCursor(response.next_cursor),
    hasMore: Boolean(response.has_more),
  };
}

function buildPlaidTransactionSummary() {
  return {
    itemsSynced: 0,
    accountsUpdated: 0,
    transactionsImported: 0,
    transactionsRemoved: 0,
    items: [],
  };
}

function buildPlaidLiabilitySummary() {
  return {
    itemsSynced: 0,
    billsUpserted: 0,
    debtsUpserted: 0,
    liabilitiesImported: 0,
    items: [],
  };
}

function supportsPlaidLiabilityAccount(account) {
  const type = String(account?.type || '').toLowerCase();
  const subtype = String(account?.subtype || '').toLowerCase();

  if (type === 'credit') {
    return subtype === 'credit card' || subtype === 'paypal';
  }

  if (type === 'loan') {
    return subtype === 'student' || subtype === 'mortgage';
  }

  return false;
}

function getPlaidLiabilityByAccountId(liabilitiesResponse = {}) {
  const map = new Map();

  for (const liability of liabilitiesResponse.credit || []) {
    map.set(String(liability.account_id), {
      type: 'credit',
      data: liability,
    });
  }

  for (const liability of liabilitiesResponse.student || []) {
    map.set(String(liability.account_id), {
      type: 'student',
      data: liability,
    });
  }

  for (const liability of liabilitiesResponse.mortgage || []) {
    map.set(String(liability.account_id), {
      type: 'mortgage',
      data: liability,
    });
  }

  return map;
}

async function deletePlaidBillByExternalAccount(client, { householdId, provider = 'plaid', externalAccountId }) {
  if (isMockDatabaseEnabled()) {
    const state = getMockState();
    const index = state.bills.findIndex((row) => (
      row.household_id === householdId
      && row.external_provider === provider
      && row.external_account_id === externalAccountId
    ));

    if (index < 0) {
      return 0;
    }

    state.bills.splice(index, 1);
    return 1;
  }

  const result = await client.query(
    `
      delete from bills
      where household_id = $1
        and external_provider = $2
        and external_account_id = $3
    `,
    [householdId, provider, externalAccountId],
  );

  return result.rowCount || 0;
}

async function upsertPlaidBill(client, row) {
  if (isMockDatabaseEnabled()) {
    return upsertMockPlaidBill(row);
  }

  const result = await client.query(
    `
      insert into bills (
        household_id,
        member_id,
        month_label,
        day_of_month,
        name,
        subtitle,
        amount,
        is_soon,
        status,
        external_provider,
        external_item_id,
        external_account_id,
        imported_at,
        sync_status
      )
      values (
        $1,
        (select id from household_members where household_id = $1 and slug = $2 limit 1),
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14
      )
      on conflict (household_id, external_provider, external_account_id)
      do update set
        member_id = excluded.member_id,
        month_label = excluded.month_label,
        day_of_month = excluded.day_of_month,
        name = excluded.name,
        subtitle = excluded.subtitle,
        amount = excluded.amount,
        is_soon = excluded.is_soon,
        status = excluded.status,
        external_item_id = excluded.external_item_id,
        imported_at = excluded.imported_at,
        sync_status = excluded.sync_status
      returning id
    `,
    [
      row.householdId,
      row.ownerSlug,
      row.monthLabel,
      row.dayOfMonth,
      row.name,
      row.subtitle,
      row.amount,
      row.isSoon,
      row.status,
      row.provider,
      row.externalItemId,
      row.externalAccountId,
      row.importedAt,
      row.syncStatus,
    ],
  );

  return result.rows[0];
}

async function upsertPlaidDebt(client, row) {
  if (isMockDatabaseEnabled()) {
    return upsertMockPlaidDebt(row);
  }

  const result = await client.query(
    `
      insert into debts (
        household_id,
        name,
        paid_amount,
        total_amount,
        apr,
        payment_amount,
        end_label,
        is_revolving,
        current_balance,
        credit_limit,
        minimum_payment_amount,
        next_payment_due_date,
        last_statement_balance,
        last_statement_issue_date,
        last_payment_amount,
        last_payment_date,
        apr_type,
        interest_charge_amount,
        liability_type,
        external_provider,
        external_item_id,
        external_account_id,
        imported_at,
        sync_status
      )
      values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16,
        $17,
        $18,
        $19,
        $20,
        $21,
        $22,
        $23,
        $24
      )
      on conflict (household_id, external_provider, external_account_id)
      do update set
        name = excluded.name,
        paid_amount = excluded.paid_amount,
        total_amount = excluded.total_amount,
        apr = excluded.apr,
        payment_amount = excluded.payment_amount,
        end_label = excluded.end_label,
        is_revolving = excluded.is_revolving,
        current_balance = excluded.current_balance,
        credit_limit = excluded.credit_limit,
        minimum_payment_amount = excluded.minimum_payment_amount,
        next_payment_due_date = excluded.next_payment_due_date,
        last_statement_balance = excluded.last_statement_balance,
        last_statement_issue_date = excluded.last_statement_issue_date,
        last_payment_amount = excluded.last_payment_amount,
        last_payment_date = excluded.last_payment_date,
        apr_type = excluded.apr_type,
        interest_charge_amount = excluded.interest_charge_amount,
        liability_type = excluded.liability_type,
        external_item_id = excluded.external_item_id,
        imported_at = excluded.imported_at,
        sync_status = excluded.sync_status
      returning id
    `,
    [
      row.householdId,
      row.name,
      row.paid,
      row.total,
      row.apr,
      row.pmt,
      row.end,
      row.revolving,
      row.currentBalance,
      row.creditLimit,
      row.minimumPaymentAmount,
      row.nextPaymentDueDate,
      row.lastStatementBalance,
      row.lastStatementIssueDate,
      row.lastPaymentAmount,
      row.lastPaymentDate,
      row.aprType,
      row.interestChargeAmount,
      row.liabilityType,
      row.provider,
      row.externalItemId,
      row.externalAccountId,
      row.importedAt,
      row.syncStatus,
    ],
  );

  return result.rows[0];
}

async function syncLiabilitiesForItem(client, {
  householdId = 1,
  provider = 'plaid',
  item,
  itemAccountOwnerMap = new Map(),
  householdMemberSlugMap = new Map(),
  env,
  fetchImpl,
  clientId,
  secret,
  asOfDate = null,
} = {}) {
  const response = await plaidRequest(
    '/liabilities/get',
    { access_token: item.access_token },
    { fetchImpl, env, clientId, secret },
  );

  const liabilities = response.liabilities || {};
  const accountsById = new Map((response.accounts || []).map((account) => [String(account.account_id), account]));
  const liabilityByAccountId = getPlaidLiabilityByAccountId(liabilities);
  const summary = {
    billsUpserted: 0,
    debtsUpserted: 0,
    liabilitiesImported: 0,
  };

  for (const [accountId, account] of accountsById.entries()) {
    if (!supportsPlaidLiabilityAccount(account)) {
      continue;
    }

    const liabilityEntry = liabilityByAccountId.get(accountId);
    if (!liabilityEntry) {
      continue;
    }

    const ownerMemberId = itemAccountOwnerMap.get(accountId);
    const ownerSlug = ownerMemberId && householdMemberSlugMap.has(ownerMemberId)
      ? householdMemberSlugMap.get(ownerMemberId)
      : 'john';
    const snapshot = buildPlaidLiabilitySnapshot({
      account,
      liability: liabilityEntry.data,
      itemId: item.item_id,
      ownerSlug,
      asOfDate,
    });

    const billRow = buildPlaidLiabilityBillRow(snapshot);
    const debtRow = buildPlaidLiabilityDebtRow(snapshot);

    await upsertPlaidBill(client, {
      ...billRow,
      householdId,
      provider,
      importedAt: new Date().toISOString(),
      syncStatus: 'synced',
    });
    await upsertPlaidDebt(client, {
      ...debtRow,
      householdId,
      provider,
      importedAt: new Date().toISOString(),
      syncStatus: 'synced',
    });

    summary.billsUpserted += 1;
    summary.debtsUpserted += 1;
    summary.liabilitiesImported += 1;
  }

  if (!isMockDatabaseEnabled()) {
    await client.query(
      `
        update plaid_items
        set sync_status = 'synced', updated_at = now()
        where household_id = $1
          and provider = $2
          and item_id = $3
      `,
      [householdId, provider, item.item_id],
    );
  } else {
    const state = getMockState();
    const plaidItem = state.plaidItems.find((row) => (
      row.household_id === householdId
      && row.provider === provider
      && row.item_id === item.item_id
    ));

    if (plaidItem) {
      plaidItem.sync_status = 'synced';
      plaidItem.updated_at = new Date().toISOString();
    }
  }

  return summary;
}

function getDefaultOwnerSlug(existingAccounts, householdMembers, fallbackOwnerSlug = 'john') {
  const ownerCounts = new Map();

  for (const account of existingAccounts) {
    const ownerSlug = householdMembers.get(Number(account.owner_member_id));

    if (!ownerSlug) {
      continue;
    }

    ownerCounts.set(ownerSlug, (ownerCounts.get(ownerSlug) || 0) + 1);
  }

  if (!ownerCounts.size) {
    return fallbackOwnerSlug;
  }

  return [...ownerCounts.entries()].sort((left, right) => right[1] - left[1])[0][0];
}

function buildPlaidReviewAccounts(accounts, { itemId, existingAccountIds = new Set(), defaultOwnerSlug = 'john' } = {}) {
  return accounts
    .filter((account) => !existingAccountIds.has(String(account.account_id)))
    .map((account) => buildPlaidAccountPreview({
      account,
      itemId,
      ownerSlug: defaultOwnerSlug,
    }));
}

function syncMockPlaidAccounts({
  householdId = 1,
  provider = 'plaid',
  itemId = null,
  fetchImpl,
  env,
  clientId,
  secret,
} = {}) {
  const state = getMockState();
  const items = state.plaidItems
    .filter((item) => item.household_id === householdId && item.provider === provider && (!itemId || item.item_id === itemId))
    .sort((left, right) => Number(left.id) - Number(right.id));

  return (async () => {
    const summary = {
      itemsSynced: 0,
      accountsUpdated: 0,
      items: [],
    };
    const householdMemberSlugMap = getHouseholdMemberSlugMap(state.members);

    for (const item of items) {
      const existingAccounts = state.accounts.filter((row) => (
        row.household_id === householdId
        && row.external_provider === provider
        && row.external_item_id === item.item_id
      ));
      const accountOwnerMap = getImportedAccountOwnerMap(existingAccounts);
      const defaultOwnerSlug = getDefaultOwnerSlug(existingAccounts, householdMemberSlugMap);
      const accountsResponse = await plaidRequest(
        '/accounts/get',
        { access_token: item.access_token },
        { fetchImpl, env, clientId, secret },
      );

      let itemUpdatedCount = 0;

      for (const account of accountsResponse.accounts || []) {
        const preview = buildPlaidAccountPreview({
          account,
          itemId: item.item_id,
          ownerSlug: getImportedAccountOwnerSlug(account.account_id, accountOwnerMap, householdMemberSlugMap, defaultOwnerSlug),
        });
        const existing = state.accounts.find((row) => (
          row.household_id === householdId
          && row.external_provider === provider
          && row.external_account_id === account.account_id
        ));

        if (existing) {
          existing.balance = normalizePlaidBalance(account);
          existing.imported_at = new Date().toISOString();
          existing.sync_status = 'synced';
        } else {
          state.accounts.push({
            id: state.nextIds.account++,
            household_id: householdId,
            owner_member_id: state.members.find((member) => member.slug === preview.ownerSlug)?.id ?? null,
            account_group: preview.accountGroup,
            name: preview.name,
            subtitle: preview.subtitle || null,
            icon: preview.icon || null,
            balance: preview.balance,
            sort_order: (state.accounts.reduce((max, row) => Math.max(max, Number(row.sort_order) || 0), -1) + 1),
            external_provider: provider,
            external_item_id: item.item_id,
            external_account_id: account.account_id,
            imported_at: new Date().toISOString(),
            sync_status: 'synced',
          });
        }
        itemUpdatedCount += 1;
        summary.accountsUpdated += 1;
      }

      item.sync_status = 'synced';
      item.updated_at = new Date().toISOString();

      summary.itemsSynced += 1;
      summary.items.push({
        itemId: item.item_id,
        accountsUpdated: itemUpdatedCount,
      });
    }

    return summary;
  })();
}

function syncMockPlaidTransactions({
  householdId = 1,
  provider = 'plaid',
  itemId = null,
  fetchImpl,
  env,
  clientId,
  secret,
} = {}) {
  const state = getMockState();
  const items = state.plaidItems
    .filter((row) => row.household_id === householdId && row.provider === provider && (!itemId || row.item_id === itemId))
    .sort((left, right) => Number(left.id) - Number(right.id));

  return (async () => {
    const summary = buildPlaidTransactionSummary();
    const householdMemberSlugMap = getHouseholdMemberSlugMap(state.members);

    for (const item of items) {
      const accountOwnerMap = getImportedAccountOwnerMap(
        state.accounts.filter((row) => (
          row.household_id === householdId
          && row.external_provider === provider
          && row.external_item_id === item.item_id
        )),
      );

      let cursor = normalizePlaidTransactionCursor(item.transaction_cursor);
      let nextCursor = cursor;
      let hasMore = true;
      let itemImportedCount = 0;
      let itemRemovedCount = 0;

      while (hasMore) {
        const response = await plaidRequest(
          '/transactions/sync',
          {
            access_token: item.access_token,
            ...(cursor ? { cursor } : {}),
          },
          { fetchImpl, env, clientId, secret },
        );

        const page = normalizePlaidTransactionPage(response);
        const pendingTransactionIdsToRemove = new Set();

        for (const transaction of [...page.added, ...page.modified]) {
          const ownerSlug = getTransactionOwnerSlug(transaction, accountOwnerMap, householdMemberSlugMap);
          const imported = buildPlaidImportedTransaction(transaction, { ownerSlug });
          if (!imported.pending && imported.pendingTransactionId) {
            pendingTransactionIdsToRemove.add(imported.pendingTransactionId);
          }

          const result = upsertMockPlaidTransactionFromPreview(state, householdId, provider, imported);

          if (result.rowCount) {
            itemImportedCount += 1;
            summary.transactionsImported += 1;
          }
        }

        for (const transactionId of pendingTransactionIdsToRemove) {
          const deleted = await deletePlaidTransactionByExternalId(null, {
            householdId,
            provider,
            transactionId,
          });
          if (deleted) {
            itemRemovedCount += 1;
            summary.transactionsRemoved += 1;
          }
        }

        for (const removed of page.removed) {
          const deleted = await deletePlaidTransactionByExternalId(null, {
            householdId,
            provider,
            transactionId: removed.transaction_id,
          });
          if (deleted) {
            itemRemovedCount += 1;
            summary.transactionsRemoved += 1;
          }
        }

        hasMore = page.hasMore;
        nextCursor = page.nextCursor || nextCursor;
        cursor = nextCursor;
      }

      item.transaction_cursor = nextCursor;
      item.updated_at = new Date().toISOString();

      summary.itemsSynced += 1;
      summary.items.push({
        itemId: item.item_id,
        transactionsImported: itemImportedCount,
        transactionsRemoved: itemRemovedCount,
      });
    }

    return summary;
  })();
}

export async function syncPlaidAccounts({
  householdId = 1,
  provider = 'plaid',
  itemId = null,
  env,
  fetchImpl,
} = {}) {
  const { clientId, secret } = getPlaidCredentials();

  if (isMockDatabaseEnabled()) {
    return syncMockPlaidAccounts({
      householdId,
      provider,
      itemId,
      env,
      fetchImpl,
      clientId,
      secret,
    });
  }

  return withClient(getAppConnectionString(), async (client) => {
    const items = await fetchPlaidItems(client, { householdId, provider, itemId });
    const householdMembers = await fetchHouseholdMembers(client, householdId);
    const householdMemberSlugMap = getHouseholdMemberSlugMap(householdMembers);
    const summary = {
      itemsSynced: 0,
      accountsUpdated: 0,
      items: [],
    };

    for (const item of items) {
      const importedAccounts = await fetchPlaidImportedAccountIds(client, { householdId, provider, itemId: item.item_id });
      const accountOwnerMap = getImportedAccountOwnerMap(importedAccounts);
      const defaultOwnerSlug = getDefaultOwnerSlug(importedAccounts, householdMemberSlugMap);
      const accountsResponse = await plaidRequest(
        '/accounts/get',
        { access_token: item.access_token },
        { fetchImpl, env, clientId, secret },
      );

      let itemUpdatedCount = 0;

      for (const account of accountsResponse.accounts || []) {
        const preview = buildPlaidAccountPreview({
          account,
          itemId: item.item_id,
          ownerSlug: getImportedAccountOwnerSlug(account.account_id, accountOwnerMap, householdMemberSlugMap, defaultOwnerSlug),
        });
        const result = await client.query(
          `
            insert into accounts (
              household_id,
              owner_member_id,
              account_group,
              name,
              subtitle,
              icon,
              balance,
              sort_order,
              external_provider,
              external_item_id,
              external_account_id,
              imported_at,
              sync_status
            )
            values (
              $1,
              (select id from household_members where household_id = $1 and slug = $2 limit 1),
              $3,
              $4,
              $5,
              $6,
              $7,
              coalesce((select max(sort_order) from accounts where household_id = $1), -1) + 1,
              $8,
              $9,
              $10,
              now(),
              'synced'
            )
            on conflict (household_id, external_provider, external_account_id)
            do update set
              balance = excluded.balance,
              imported_at = excluded.imported_at,
              sync_status = excluded.sync_status
            returning id
          `,
          [
            householdId,
            preview.ownerSlug,
            preview.accountGroup,
            preview.name,
            preview.subtitle,
            preview.icon,
            preview.balance,
            provider,
            item.item_id,
            account.account_id,
          ],
        );

        if (result.rowCount) {
          itemUpdatedCount += 1;
          summary.accountsUpdated += 1;
        }
      }

      await client.query(
        `
          update plaid_items
          set sync_status = 'synced', updated_at = now()
          where id = $1
        `,
        [item.id],
      );

      summary.itemsSynced += 1;
      summary.items.push({
        itemId: item.item_id,
        accountsUpdated: itemUpdatedCount,
      });
    }

    return summary;
  });
}

export async function syncPlaidTransactions({
  householdId = 1,
  provider = 'plaid',
  itemId = null,
  env,
  fetchImpl,
} = {}) {
  const { clientId, secret } = getPlaidCredentials();

  if (isMockDatabaseEnabled()) {
    return syncMockPlaidTransactions({
      householdId,
      provider,
      itemId,
      env,
      fetchImpl,
      clientId,
      secret,
    });
  }

  return withClient(getAppConnectionString(), async (client) => {
    const items = await fetchPlaidItems(client, { householdId, provider, itemId });
    const summary = buildPlaidTransactionSummary();
    const householdResult = await client.query(
      `
        select as_of
        from households
        where id = $1
        limit 1
      `,
      [householdId],
    );
    const householdAsOf = householdResult.rows[0]?.as_of || new Date().toISOString().slice(0, 10);
    const householdMembers = await fetchHouseholdMembers(client, householdId);
    const householdMemberSlugMap = getHouseholdMemberSlugMap(householdMembers);

    for (const item of items) {
      const importedAccounts = await fetchPlaidImportedAccountIds(client, { householdId, provider, itemId: item.item_id });
      const accountOwnerMap = getImportedAccountOwnerMap(importedAccounts);
      let cursor = normalizePlaidTransactionCursor(item.transaction_cursor);
      let nextCursor = cursor;
      let hasMore = true;
      let itemImportedCount = 0;
      let itemRemovedCount = 0;

      while (hasMore) {
        const response = await plaidRequest(
          '/transactions/sync',
          {
            access_token: item.access_token,
            ...(cursor ? { cursor } : {}),
          },
          { fetchImpl, env, clientId, secret },
        );

        const page = normalizePlaidTransactionPage(response);
        const pendingTransactionIdsToRemove = new Set();

        for (const transaction of [...page.added, ...page.modified]) {
          const ownerSlug = getTransactionOwnerSlug(transaction, accountOwnerMap, householdMemberSlugMap);
          const imported = buildPlaidImportedTransaction(transaction, { ownerSlug });
          if (!imported.pending && imported.pendingTransactionId) {
            pendingTransactionIdsToRemove.add(imported.pendingTransactionId);
          }

          const result = await client.query(
            `
              insert into transactions (
                household_id,
                member_id,
                posted_date,
                posted_label,
                merchant,
                category,
                amount,
                time_label,
                emoji,
                is_income,
                sort_order,
                external_provider,
                external_item_id,
                external_account_id,
                external_transaction_id,
                imported_at,
                sync_status
              )
              values (
                $1,
                (select id from household_members where household_id = $1 and slug = $2 limit 1),
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                coalesce((select max(sort_order) from transactions where household_id = $1), -1) + 1,
                $11,
                $12,
                $13,
                $14,
                $15,
                $16
              )
              on conflict (household_id, external_provider, external_transaction_id)
              do update set
                member_id = excluded.member_id,
                posted_date = excluded.posted_date,
                posted_label = excluded.posted_label,
                merchant = excluded.merchant,
                category = excluded.category,
                amount = excluded.amount,
                time_label = excluded.time_label,
                emoji = excluded.emoji,
                is_income = excluded.is_income,
                external_item_id = excluded.external_item_id,
                external_account_id = excluded.external_account_id,
                imported_at = excluded.imported_at,
                sync_status = excluded.sync_status
              returning id
            `,
            [
              householdId,
              imported.memberSlug,
              imported.postedDate,
              formatTransactionDayLabel(imported.postedDate, householdAsOf),
              imported.merchant,
              imported.category,
              imported.amount,
              imported.timeLabel,
              imported.emoji,
              imported.isIncome,
              provider,
              item.item_id,
              imported.externalAccountId,
              imported.externalTransactionId,
              imported.importedAt,
              imported.syncStatus,
            ],
          );

          if (result.rowCount) {
            itemImportedCount += 1;
            summary.transactionsImported += 1;
          }
        }

        for (const transactionId of pendingTransactionIdsToRemove) {
          const deleted = await deletePlaidTransactionByExternalId(client, {
            householdId,
            provider,
            transactionId,
          });

          if (deleted) {
            itemRemovedCount += 1;
            summary.transactionsRemoved += 1;
          }
        }

        for (const removed of page.removed) {
          const result = await client.query(
            `
              delete from transactions
              where household_id = $1
                and external_provider = $2
                and external_transaction_id = $3
            `,
            [householdId, provider, removed.transaction_id],
          );

          if (result.rowCount) {
            itemRemovedCount += 1;
            summary.transactionsRemoved += 1;
          }
        }

        hasMore = page.hasMore;
        nextCursor = page.nextCursor || nextCursor;
        cursor = nextCursor;
      }

      await client.query(
        `
          update plaid_items
          set transaction_cursor = $1, updated_at = now()
          where household_id = $2
            and provider = $3
            and item_id = $4
        `,
        [nextCursor, householdId, provider, item.item_id],
      );

      summary.itemsSynced += 1;
      summary.items.push({
        itemId: item.item_id,
        transactionsImported: itemImportedCount,
        transactionsRemoved: itemRemovedCount,
      });
    }

    return summary;
  });
}

export async function syncPlaidLiabilities({
  householdId = 1,
  provider = 'plaid',
  itemId = null,
  env,
  fetchImpl,
} = {}) {
  const { clientId, secret } = getPlaidCredentials();

  if (isMockDatabaseEnabled()) {
    return withClient(getAppConnectionString(), async (client) => {
      const items = await fetchPlaidItems(client, { householdId, provider, itemId });
      const householdMembers = await fetchHouseholdMembers(client, householdId);
      const householdMemberSlugMap = getHouseholdMemberSlugMap(householdMembers);
      const summary = buildPlaidLiabilitySummary();
      const householdResult = await client.query(
        `
          select as_of
          from households
          where id = $1
          limit 1
        `,
        [householdId],
      );
      const householdAsOf = householdResult.rows[0]?.as_of || new Date().toISOString().slice(0, 10);

      for (const item of items) {
        const importedAccounts = await fetchPlaidImportedAccountIds(client, { householdId, provider, itemId: item.item_id });
        const accountOwnerMap = getImportedAccountOwnerMap(importedAccounts);
        let itemSummary = { billsUpserted: 0, debtsUpserted: 0, liabilitiesImported: 0 };

        try {
          itemSummary = await syncLiabilitiesForItem(client, {
            householdId,
            provider,
            item,
            itemAccountOwnerMap: accountOwnerMap,
            householdMemberSlugMap,
            env,
            fetchImpl,
            clientId,
            secret,
            asOfDate: householdAsOf,
          });
        } catch (error) {
          const message = String(error?.message || '');
          if (!/liabilit/i.test(message)) {
            throw error;
          }
        }

        summary.itemsSynced += 1;
        summary.billsUpserted += itemSummary.billsUpserted;
        summary.debtsUpserted += itemSummary.debtsUpserted;
        summary.liabilitiesImported += itemSummary.liabilitiesImported;
        summary.items.push({
          itemId: item.item_id,
          billsUpserted: itemSummary.billsUpserted,
          debtsUpserted: itemSummary.debtsUpserted,
        });
      }

      return summary;
    });
  }

  return withClient(getAppConnectionString(), async (client) => {
    const items = await fetchPlaidItems(client, { householdId, provider, itemId });
    const householdMembers = await fetchHouseholdMembers(client, householdId);
    const householdMemberSlugMap = getHouseholdMemberSlugMap(householdMembers);
    const summary = buildPlaidLiabilitySummary();
    const householdResult = await client.query(
      `
        select as_of
        from households
        where id = $1
        limit 1
      `,
      [householdId],
    );
    const householdAsOf = householdResult.rows[0]?.as_of || new Date().toISOString().slice(0, 10);

    for (const item of items) {
      const importedAccounts = await fetchPlaidImportedAccountIds(client, { householdId, provider, itemId: item.item_id });
      const accountOwnerMap = getImportedAccountOwnerMap(importedAccounts);
      let itemSummary = { billsUpserted: 0, debtsUpserted: 0, liabilitiesImported: 0 };

      try {
        itemSummary = await syncLiabilitiesForItem(client, {
          householdId,
          provider,
          item,
          itemAccountOwnerMap: accountOwnerMap,
          householdMemberSlugMap,
          env,
          fetchImpl,
          clientId,
          secret,
          asOfDate: householdAsOf,
        });
      } catch (error) {
        const message = String(error?.message || '');
        if (!/liabilit/i.test(message)) {
          throw error;
        }
      }

      summary.itemsSynced += 1;
      summary.billsUpserted += itemSummary.billsUpserted;
      summary.debtsUpserted += itemSummary.debtsUpserted;
      summary.liabilitiesImported += itemSummary.liabilitiesImported;
      summary.items.push({
        itemId: item.item_id,
        billsUpserted: itemSummary.billsUpserted,
        debtsUpserted: itemSummary.debtsUpserted,
      });
    }

    return summary;
  });
}

export async function syncPlaidData({
  householdId = 1,
  provider = 'plaid',
  itemId = null,
  env,
  fetchImpl,
} = {}) {
  const accounts = await syncPlaidAccounts({
    householdId,
    provider,
    itemId,
    env,
    fetchImpl,
  });
  const transactions = await syncPlaidTransactions({
    householdId,
    provider,
    itemId,
    env,
    fetchImpl,
  });
  const liabilities = await syncPlaidLiabilities({
    householdId,
    provider,
    itemId,
    env,
    fetchImpl,
  });

  return {
    itemsSynced: Math.max(accounts.itemsSynced, transactions.itemsSynced, liabilities.itemsSynced),
    accountsUpdated: accounts.accountsUpdated,
    transactionsImported: transactions.transactionsImported,
    transactionsRemoved: transactions.transactionsRemoved,
    billsUpserted: liabilities.billsUpserted,
    debtsUpserted: liabilities.debtsUpserted,
    liabilitiesImported: liabilities.liabilitiesImported,
    items: accounts.items.map((item, index) => ({
      ...item,
      transactionsImported: transactions.items[index]?.transactionsImported || 0,
      transactionsRemoved: transactions.items[index]?.transactionsRemoved || 0,
      billsUpserted: liabilities.items[index]?.billsUpserted || 0,
      debtsUpserted: liabilities.items[index]?.debtsUpserted || 0,
    })),
  };
}

export async function reviewPlaidItemAccounts({
  householdId = 1,
  itemId,
  env,
  fetchImpl,
} = {}) {
  const { clientId, secret } = getPlaidCredentials();
  const normalizedItemId = String(itemId || '').trim();

  if (!normalizedItemId) {
    throw new Error('Plaid item ID is required');
  }

  const item = await withClient(getAppConnectionString(), async (client) => {
    return fetchPlaidItem(client, { householdId, itemId: normalizedItemId });
  });

  if (!item) {
    throw new Error('Plaid item not found');
  }

  const accountsResponse = await plaidRequest(
    '/accounts/get',
    { access_token: item.access_token },
    { fetchImpl, env, clientId, secret },
  );

  const existingAccounts = isMockDatabaseEnabled()
    ? (await (async () => {
        const state = getMockState();
        return state.accounts.filter((account) => (
          account.household_id === householdId
          && account.external_provider === 'plaid'
          && account.external_item_id === normalizedItemId
        ));
      })())
    : await withClient(getAppConnectionString(), async (client) => {
      return fetchPlaidImportedAccountIds(client, {
        householdId,
        provider: 'plaid',
        itemId: normalizedItemId,
      });
    });

  const existingAccountIds = new Set(existingAccounts.map((account) => String(account.external_account_id || account.externalAccountId)));
  const householdMembers = isMockDatabaseEnabled()
    ? new Map(getMockState().members.map((member) => [member.id, member.slug]))
    : await withClient(getAppConnectionString(), async (client) => {
      const rows = await fetchHouseholdMembers(client, householdId);
      return new Map(rows.map((row) => [Number(row.id), row.slug]));
    });
  const defaultOwnerSlug = getDefaultOwnerSlug(existingAccounts, householdMembers);
  const accounts = buildPlaidReviewAccounts(accountsResponse.accounts || [], {
    itemId: item.item_id,
    existingAccountIds,
    defaultOwnerSlug,
  });

  return {
    connection: {
      id: item.id,
      provider: item.provider,
      itemId: item.item_id,
      institutionName: item.institution_name,
      linkSessionId: item.link_session_id,
      syncStatus: item.sync_status,
    },
    accounts,
  };
}

export async function createPlaidUpdateToken({
  householdId = 1,
  itemId,
  env,
  fetchImpl,
} = {}) {
  const { clientId, secret } = getPlaidCredentials();
  const redirectUri = String(process.env.PLAID_REDIRECT_URI || '').trim();
  const webhookUrl = String(process.env.PLAID_WEBHOOK_URL || '').trim();
  const normalizedItemId = String(itemId || '').trim();

  if (!normalizedItemId) {
    throw new Error('Plaid item ID is required');
  }

  const item = await withClient(getAppConnectionString(), async (client) => {
    return fetchPlaidItem(client, { householdId, itemId: normalizedItemId });
  });

  if (!item) {
    throw new Error('Plaid item not found');
  }

  const response = await plaidRequest(
    '/link/token/create',
    {
      client_name: 'Family Financials',
      user: {
        client_user_id: `household-${householdId}`,
      },
      country_codes: ['US'],
      language: 'en',
      access_token: item.access_token,
      update: {
        account_selection_enabled: true,
      },
      ...(redirectUri ? { redirect_uri: redirectUri } : {}),
      ...(webhookUrl ? { webhook: webhookUrl } : {}),
    },
    { fetchImpl, env, clientId, secret },
  );

  return {
    linkToken: response.link_token,
    expiration: response.expiration,
    requestId: response.request_id,
    itemId: item.item_id,
    syncStatus: item.sync_status,
  };
}

export async function createPlaidLinkToken({ householdId = 1, env, fetchImpl } = {}) {
  const { clientId, secret } = getPlaidCredentials();
  const redirectUri = String(process.env.PLAID_REDIRECT_URI || '').trim();
  const webhookUrl = String(process.env.PLAID_WEBHOOK_URL || '').trim();
  const response = await plaidRequest(
    '/link/token/create',
    {
      client_name: 'Family Financials',
      user: {
        client_user_id: `household-${householdId}`,
      },
      products: ['transactions', 'liabilities'],
      transactions: {
        days_requested: 730,
      },
      country_codes: ['US'],
      language: 'en',
      ...(redirectUri ? { redirect_uri: redirectUri } : {}),
      ...(webhookUrl ? { webhook: webhookUrl } : {}),
    },
    { fetchImpl, env, clientId, secret },
  );

  return {
    linkToken: response.link_token,
    expiration: response.expiration,
    requestId: response.request_id,
  };
}

export async function exchangePlaidPublicToken({
  householdId = 1,
  publicToken,
  selectedAccountIds = [],
  ownerSlug = 'john',
  institutionName = '',
  linkSessionId = '',
  env,
  fetchImpl,
} = {}) {
  const { clientId, secret } = getPlaidCredentials();
  const exchange = await plaidRequest(
    '/item/public_token/exchange',
    { public_token: publicToken },
    { fetchImpl, env, clientId, secret },
  );
  const accountsResponse = await plaidRequest(
    '/accounts/get',
    { access_token: exchange.access_token },
    { fetchImpl, env, clientId, secret },
  );

  const selectedIds = new Set((selectedAccountIds || []).map((value) => String(value)));
  const accountPreviews = accountsResponse.accounts
    .filter((account) => {
      if (!selectedIds.size) {
        return true;
      }

      return selectedIds.has(String(account.account_id));
    })
    .map((account) => buildPlaidAccountPreview({
      account,
      itemId: exchange.item_id,
      ownerSlug,
    }));

  const item = await withClient(getAppConnectionString(), async (client) => {
    return upsertPlaidItem(client, {
      householdId,
      provider: 'plaid',
      itemId: exchange.item_id,
      accessToken: exchange.access_token,
      institutionName,
      linkSessionId,
      syncStatus: 'linked',
    });
  });

  for (const account of accountPreviews) {
    await syncImportedAccount({
      provider: 'plaid',
      externalItemId: account.externalItemId,
      externalAccountId: account.externalAccountId,
      accountGroup: account.accountGroup,
      name: account.name,
      subtitle: account.subtitle,
      icon: account.icon,
      balance: account.balance,
      ownerSlug: account.ownerSlug,
    });
  }

  const liabilitySync = await syncPlaidLiabilities({
    householdId,
    provider: 'plaid',
    itemId: exchange.item_id,
    env,
    fetchImpl,
  });

  return {
    connection: {
      id: item.id,
      provider: item.provider,
      itemId: item.item_id,
      institutionName: item.institution_name,
      linkSessionId: item.link_session_id,
      syncStatus: item.sync_status,
    },
    accounts: accountPreviews,
    liabilities: liabilitySync,
  };
}

export function getPlaidBaseUrlForTesting(env = 'sandbox') {
  return getPlaidBaseUrl(env);
}
