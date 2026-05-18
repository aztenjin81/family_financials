import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import test from 'node:test';

import { getDashboardData } from '../scripts/dashboard-query.mjs';
import { handleApiRequest } from '../scripts/api-handler.mjs';
import { resetMockDatabase } from '../scripts/mock-db.mjs';
import { syncPlaidData } from '../scripts/plaid-commands.mjs';
import {
  buildPlaidAccountPreview,
  formatPlaidAccountSubtitle,
  mapPlaidAccountGroup,
  mapPlaidAccountIcon,
  normalizePlaidBalance,
} from '../src/lib/plaid.js';

function createResponse() {
  const response = new EventEmitter();
  response.statusCode = null;
  response.headers = null;
  response.body = '';
  response.writeHead = (statusCode, headers) => {
    response.statusCode = statusCode;
    response.headers = headers;
  };
  response.end = (body = '') => {
    response.body += body;
    response.emit('finish');
  };
  return response;
}

function createRequest({ method = 'GET', url = '/', body = null, rawBody = null, headers = {} } = {}) {
  const requestBody = rawBody != null ? String(rawBody) : body === null ? null : JSON.stringify(body);
  const request = requestBody === null ? Readable.from([]) : Readable.from([requestBody]);
  request.method = method;
  request.url = url;
  request.headers = {
    host: '127.0.0.1',
    'content-type': 'application/json',
    ...headers,
  };
  return request;
}

function createFetchResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function derToJose(signature) {
  const der = Buffer.from(signature);
  let offset = 0;

  if (der[offset++] !== 0x30) {
    throw new Error('Invalid DER signature');
  }

  const length = der[offset++];
  if (length + 2 !== der.length) {
    throw new Error('Invalid DER signature length');
  }

  if (der[offset++] !== 0x02) {
    throw new Error('Invalid DER signature');
  }

  const rLength = der[offset++];
  let r = der.subarray(offset, offset + rLength);
  offset += rLength;

  if (der[offset++] !== 0x02) {
    throw new Error('Invalid DER signature');
  }

  const sLength = der[offset++];
  let s = der.subarray(offset, offset + sLength);

  while (r.length > 0 && r[0] === 0) {
    r = r.subarray(1);
  }

  while (s.length > 0 && s[0] === 0) {
    s = s.subarray(1);
  }

  if (r.length > 32 || s.length > 32) {
    throw new Error('Invalid DER signature values');
  }

  return Buffer.concat([Buffer.alloc(32 - r.length), r, Buffer.alloc(32 - s.length), s]);
}

function createPlaidVerificationJwt({ body, privateKey, kid = 'webhook-key-1', iat = Math.floor(Date.now() / 1000) } = {}) {
  const header = { alg: 'ES256', kid, typ: 'JWT' };
  const payload = {
    iat,
    request_body_sha256: crypto.createHash('sha256').update(body).digest('hex'),
  };
  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const derSignature = crypto.sign('sha256', Buffer.from(signingInput), privateKey);
  const rawSignature = derToJose(derSignature);

  return `${signingInput}.${base64UrlEncode(rawSignature)}`;
}

test('maps plaid account metadata into household-friendly account defaults', () => {
  const account = {
    account_id: 'acc-123',
    name: 'Plaid Checking',
    official_name: 'Plaid Gold Standard 0% Interest Checking',
    mask: '0000',
    type: 'depository',
    subtype: 'checking',
    balances: { current: 1234.56 },
  };

  assert.equal(mapPlaidAccountGroup(account), 'Cash');
  assert.equal(mapPlaidAccountIcon(account), 'Bank');
  assert.equal(formatPlaidAccountSubtitle(account), 'Plaid Gold Standard 0% Interest Checking · ••0000');
  assert.equal(normalizePlaidBalance(account), 1234.56);

  const credit = buildPlaidAccountPreview({
    account: {
      account_id: 'acc-456',
      name: 'Plaid Credit Card',
      type: 'credit',
      subtype: 'credit card',
      balances: { current: 42.25 },
    },
    itemId: 'item-123',
    ownerSlug: 'john',
  });

  assert.deepEqual(credit, {
    provider: 'plaid',
    externalItemId: 'item-123',
    externalAccountId: 'acc-456',
    accountGroup: 'Credit',
    name: 'Plaid Credit Card',
    subtitle: 'credit card',
    icon: 'Card',
    balance: -42.25,
    ownerSlug: 'john',
    accountType: 'credit',
    accountSubtype: 'credit card',
  });
});

test('handleApiRequest creates a Plaid link token, exchanges a public token, and syncs balances without overwriting manual edits', async () => {
  const originalUseMockDb = process.env.USE_MOCK_DB;
  const originalClientId = process.env.PLAID_CLIENT_ID;
  const originalSecret = process.env.PLAID_SECRET;
  const originalRedirectUri = process.env.PLAID_REDIRECT_URI;
  const originalWebhookUrl = process.env.PLAID_WEBHOOK_URL;
  const originalFetch = global.fetch;
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const webhookVerificationKey = publicKey.export({ format: 'jwk' });
  process.env.USE_MOCK_DB = '1';
  process.env.PLAID_CLIENT_ID = 'test-client';
  process.env.PLAID_SECRET = 'test-secret';
  process.env.PLAID_REDIRECT_URI = 'https://example.com/plaid/oauth';
  process.env.PLAID_WEBHOOK_URL = 'https://example.com/plaid/webhook';
  resetMockDatabase();
  let accountsGetCalls = 0;
  let transactionsSyncCalls = 0;

  global.fetch = async (url, options) => {
    const path = String(url);
    const body = JSON.parse(options.body);

    if (path.endsWith('/link/token/create') && body.access_token) {
      assert.equal(body.client_id, 'test-client');
      assert.equal(body.secret, 'test-secret');
      assert.equal(body.access_token, 'access-token-123');
      assert.deepEqual(body.update, { account_selection_enabled: true });
      assert.equal(body.redirect_uri, 'https://example.com/plaid/oauth');
      assert.equal(body.webhook, 'https://example.com/plaid/webhook');
      return createFetchResponse({
        link_token: 'link-update-123',
        expiration: '2026-05-16T12:30:00Z',
        request_id: 'request-update',
      });
    }

    if (path.endsWith('/link/token/create')) {
      assert.equal(body.client_id, 'test-client');
      assert.equal(body.secret, 'test-secret');
      assert.deepEqual(body.products, ['transactions', 'liabilities']);
      assert.deepEqual(body.transactions, { days_requested: 730 });
      assert.equal(body.redirect_uri, 'https://example.com/plaid/oauth');
      assert.equal(body.webhook, 'https://example.com/plaid/webhook');
      return createFetchResponse({
        link_token: 'link-sandbox-123',
        expiration: '2026-05-16T12:00:00Z',
        request_id: 'request-link',
      });
    }

    if (path.endsWith('/item/public_token/exchange')) {
      assert.equal(body.public_token, 'public-token-123');
      return createFetchResponse({
        access_token: 'access-token-123',
        item_id: 'item-123',
        request_id: 'request-exchange',
      });
    }

    if (path.endsWith('/accounts/get')) {
      assert.equal(body.access_token, 'access-token-123');
      accountsGetCalls += 1;

      if (accountsGetCalls === 1) {
        return createFetchResponse({
          accounts: [
            {
              account_id: 'account-1',
              name: 'Plaid Checking',
              official_name: 'Plaid Gold Standard 0% Interest Checking',
              mask: '0000',
              type: 'depository',
              subtype: 'checking',
              balances: { current: 412.34, available: 400.12 },
            },
            {
              account_id: 'account-2',
              name: 'Plaid Credit Card',
              subtype: 'credit card',
              type: 'credit',
              balances: { current: 98.76 },
            },
          ],
        });
      }

      if (accountsGetCalls >= 2) {
        return createFetchResponse({
          accounts: [
            {
              account_id: 'account-1',
              name: 'Plaid Checking',
              official_name: 'Plaid Gold Standard 0% Interest Checking',
              mask: '0000',
              type: 'depository',
              subtype: 'checking',
              balances: { current: 512.34, available: 500.12 },
            },
            {
              account_id: 'account-2',
              name: 'Plaid Credit Card',
              subtype: 'credit card',
              type: 'credit',
              balances: { current: 88.76 },
            },
          ],
        });
      }
    }

    if (path.endsWith('/transactions/sync')) {
      assert.equal(body.access_token, 'access-token-123');
      transactionsSyncCalls += 1;

      if (transactionsSyncCalls === 1) {
        return createFetchResponse({
          added: [
            {
              transaction_id: 'txn-1',
              account_id: 'account-1',
              amount: 42.18,
              date: '2026-05-10',
              merchant_name: 'Plaid Imported Groceries',
              name: 'Plaid Imported Groceries',
              category: ['Groceries'],
              personal_finance_category: {
                primary: 'FOOD_AND_DRINK',
                detailed: 'FOOD_AND_DRINK_GROCERIES',
              },
              pending: false,
            },
            {
              transaction_id: 'txn-pending-1',
              account_id: 'account-1',
              amount: 8.75,
              date: '2026-05-11',
              merchant_name: 'Plaid Pending Coffee',
              name: 'Plaid Pending Coffee',
              category: ['Coffee Shops'],
              personal_finance_category: {
                primary: 'FOOD_AND_DRINK',
                detailed: 'FOOD_AND_DRINK_COFFEE',
              },
              pending: true,
            },
          ],
          modified: [],
          removed: [],
          next_cursor: 'cursor-1',
          has_more: false,
          accounts: [
            { account_id: 'account-1' },
            { account_id: 'account-2' },
          ],
          transactions_update_status: 'HISTORICAL_UPDATE_COMPLETE',
        });
      }

      return createFetchResponse({
        added: [
          {
            transaction_id: 'txn-posted-1',
            account_id: 'account-1',
            amount: 8.75,
            date: '2026-05-11',
            merchant_name: 'Plaid Posted Coffee',
            name: 'Plaid Posted Coffee',
            category: ['Coffee Shops'],
            personal_finance_category: {
              primary: 'FOOD_AND_DRINK',
              detailed: 'FOOD_AND_DRINK_COFFEE',
            },
            pending: false,
            pending_transaction_id: 'txn-pending-1',
          },
        ],
        modified: [],
        removed: [],
        next_cursor: 'cursor-1',
        has_more: false,
        accounts: [
          { account_id: 'account-1' },
          { account_id: 'account-2' },
        ],
        transactions_update_status: 'HISTORICAL_UPDATE_COMPLETE',
      });
    }

    if (path.endsWith('/liabilities/get')) {
      assert.equal(body.access_token, 'access-token-123');
      return createFetchResponse({
        accounts: [
          {
            account_id: 'account-1',
            balances: {
              current: 512.34,
              limit: null,
              available: 500.12,
              iso_currency_code: 'USD',
            },
            mask: '0000',
            name: 'Plaid Checking',
            official_name: 'Plaid Gold Standard 0% Interest Checking',
            subtype: 'checking',
            type: 'depository',
          },
          {
            account_id: 'account-2',
            balances: {
              current: 88.76,
              limit: 5000,
              available: null,
              iso_currency_code: 'USD',
            },
            mask: '1111',
            name: 'Plaid Credit Card',
            official_name: 'Plaid Diamond Credit Card',
            subtype: 'credit card',
            type: 'credit',
          },
        ],
        liabilities: {
          credit: [
            {
              account_id: 'account-2',
              aprs: [
                {
                  apr_percentage: 22.99,
                  apr_type: 'purchase_apr',
                  balance_subject_to_apr: 88.76,
                  interest_charge_amount: 1.42,
                },
              ],
              is_overdue: false,
              last_payment_amount: 35,
              last_payment_date: '2026-05-03',
              last_statement_issue_date: '2026-05-01',
              last_statement_balance: 123.45,
              minimum_payment_amount: 35,
              next_payment_due_date: '2026-05-18',
            },
          ],
          mortgage: [],
          student: [],
        },
      });
    }

    if (path.endsWith('/webhook_verification_key/get')) {
      assert.equal(body.key_id, 'webhook-key-1');
      return createFetchResponse({
        key: webhookVerificationKey,
        request_id: 'request-key',
      });
    }

    throw new Error(`Unexpected fetch URL: ${path}`);
  };

  try {
    const linkResponse = createResponse();
    await handleApiRequest(createRequest({ method: 'POST', url: '/api/plaid/link-token' }), linkResponse);
    const linkData = JSON.parse(linkResponse.body);

    assert.equal(linkResponse.statusCode, 200);
    assert.equal(linkData.linkToken, 'link-sandbox-123');

    const exchangeResponse = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'POST',
        url: '/api/plaid/exchange',
        body: {
          publicToken: 'public-token-123',
          selectedAccountIds: ['account-1'],
          ownerSlug: 'john',
          institutionName: 'Plaid Credit Union',
          linkSessionId: 'link-session-123',
        },
      }),
      exchangeResponse,
    );
    const exchangeData = JSON.parse(exchangeResponse.body);

    assert.equal(exchangeResponse.statusCode, 200);
    assert.equal(exchangeData.connection.itemId, 'item-123');
    assert.equal(exchangeData.connection.institutionName, 'Plaid Credit Union');
    assert.equal(exchangeData.accounts.length, 1);
    assert.equal(exchangeData.accounts[0].externalAccountId, 'account-1');
    assert.equal(exchangeData.accounts[0].accountGroup, 'Cash');
    assert.equal(exchangeData.accounts[0].icon, 'Bank');
    assert.equal(exchangeData.accounts[0].ownerSlug, 'john');

    const importResponse = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'POST',
        url: '/api/accounts/import',
        body: {
          provider: 'plaid',
          externalItemId: exchangeData.accounts[0].externalItemId,
          externalAccountId: exchangeData.accounts[0].externalAccountId,
          accountGroup: exchangeData.accounts[0].accountGroup,
          name: exchangeData.accounts[0].name,
          subtitle: exchangeData.accounts[0].subtitle,
          icon: exchangeData.accounts[0].icon,
          balance: exchangeData.accounts[0].balance,
          ownerSlug: exchangeData.accounts[0].ownerSlug,
        },
      }),
      importResponse,
    );
    const importData = JSON.parse(importResponse.body);

    assert.equal(importResponse.statusCode, 200);
    assert.equal(importData.account.externalAccountId, 'account-1');

    const updateResponse = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'PATCH',
        url: `/api/accounts/${importData.account.id}`,
        body: {
          ownerSlug: 'stephanie',
          accountGroup: 'Household Cash',
          name: 'Joint Checking',
          subtitle: 'edited manually',
          icon: 'Vault',
          balance: 999,
        },
      }),
      updateResponse,
    );

    assert.equal(updateResponse.statusCode, 200);

    const updateTokenResponse = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'POST',
        url: '/api/plaid/update-token',
        body: {
          itemId: 'item-123',
        },
      }),
      updateTokenResponse,
    );
    const updateTokenData = JSON.parse(updateTokenResponse.body);

    assert.equal(updateTokenResponse.statusCode, 200);
    assert.equal(updateTokenData.linkToken, 'link-update-123');
    assert.equal(updateTokenData.itemId, 'item-123');

    const reviewResponse = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'POST',
        url: '/api/plaid/review',
        body: {
          itemId: 'item-123',
        },
      }),
      reviewResponse,
    );
    const reviewData = JSON.parse(reviewResponse.body);

    assert.equal(reviewResponse.statusCode, 200);
    assert.equal(reviewData.connection.itemId, 'item-123');
    assert.equal(reviewData.accounts.length, 1);
    assert.equal(reviewData.accounts[0].externalAccountId, 'account-2');
    assert.equal(reviewData.accounts[0].accountGroup, 'Credit');
    assert.equal(reviewData.accounts[0].icon, 'Card');
    assert.equal(reviewData.accounts[0].ownerSlug, 'stephanie');

    const secondImportResponse = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'POST',
        url: '/api/accounts/import',
        body: {
          provider: 'plaid',
          externalItemId: reviewData.accounts[0].externalItemId,
          externalAccountId: reviewData.accounts[0].externalAccountId,
          accountGroup: reviewData.accounts[0].accountGroup,
          name: reviewData.accounts[0].name,
          subtitle: reviewData.accounts[0].subtitle,
          icon: reviewData.accounts[0].icon,
          balance: reviewData.accounts[0].balance,
          ownerSlug: reviewData.accounts[0].ownerSlug,
        },
      }),
      secondImportResponse,
    );
    const secondImportData = JSON.parse(secondImportResponse.body);

    assert.equal(secondImportResponse.statusCode, 201);
    assert.equal(secondImportData.account.externalAccountId, 'account-2');

    const syncRouteResponse = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'POST',
        url: '/api/plaid/sync',
        body: {
          itemId: 'item-123',
        },
      }),
      syncRouteResponse,
    );
    const syncRouteData = JSON.parse(syncRouteResponse.body);

    assert.equal(syncRouteResponse.statusCode, 200);
    assert.equal(syncRouteData.itemsSynced, 1);
    assert.equal(syncRouteData.accountsUpdated, 2);
    assert.equal(syncRouteData.transactionsImported, 2);
    assert.equal(syncRouteData.transactionsRemoved, 0);

    const dashboardAfterSync = await getDashboardData();
    const importedTransaction = dashboardAfterSync.transactions.flatMap((group) => group.items).find((transaction) => transaction.merch === 'Plaid Imported Groceries');
    const pendingTransaction = dashboardAfterSync.transactions.flatMap((group) => group.items).find((transaction) => transaction.merch === 'Plaid Pending Coffee');

    assert.ok(importedTransaction);
    assert.equal(importedTransaction.who, 'stephanie');
    assert.equal(importedTransaction.cat, 'Groceries');
    assert.equal(importedTransaction.amt, -42.18);
    assert.equal(importedTransaction.syncStatus, 'synced');
    assert.ok(pendingTransaction);
    assert.equal(pendingTransaction.who, 'stephanie');
    assert.equal(pendingTransaction.syncStatus, 'pending');

    const webhookBody = JSON.stringify({
      webhook_type: 'TRANSACTIONS',
      webhook_code: 'SYNC_UPDATES_AVAILABLE',
      item_id: 'item-123',
      environment: 'sandbox',
    });
    const webhookToken = createPlaidVerificationJwt({
      body: webhookBody,
      privateKey,
      kid: 'webhook-key-1',
    });

    const syncResponse = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'POST',
        url: '/api/plaid/webhook',
        rawBody: webhookBody,
        headers: {
          'plaid-verification': webhookToken,
        },
      }),
      syncResponse,
    );
    const syncData = JSON.parse(syncResponse.body);

    assert.equal(syncResponse.statusCode, 200);
    assert.equal(syncData.action, 'synced');
    assert.equal(syncData.webhookType, 'TRANSACTIONS');
    assert.equal(syncData.webhookCode, 'SYNC_UPDATES_AVAILABLE');
    assert.equal(syncData.transactionsImported, 1);
    assert.equal(syncData.transactionsRemoved, 1);

    const dashboard = await getDashboardData();
    const importedAccount = dashboard.accounts.flatMap((group) => group.items).find((account) => account.externalAccountId === 'account-1');

    assert.ok(importedAccount);
    assert.equal(importedAccount.externalProvider, 'plaid');
    assert.equal(importedAccount.externalItemId, 'item-123');
    assert.equal(importedAccount.owner, 'stephanie');
    assert.equal(importedAccount.group, 'Household Cash');
    assert.equal(importedAccount.name, 'Joint Checking');
    assert.equal(importedAccount.sub, 'edited manually');
    assert.equal(importedAccount.icon, 'Vault');
    assert.equal(importedAccount.bal, 512.34);
    assert.equal(importedAccount.importedAt != null, true);
    assert.equal(importedAccount.syncStatus, 'synced');

    const importedAccount2 = dashboard.accounts.flatMap((group) => group.items).find((account) => account.externalAccountId === 'account-2');

    assert.ok(importedAccount2);
    assert.equal(importedAccount2.externalProvider, 'plaid');
    assert.equal(importedAccount2.externalItemId, 'item-123');
    assert.equal(importedAccount2.owner, 'stephanie');
    assert.equal(importedAccount2.bal, -88.76);
    assert.equal(importedAccount2.syncStatus, 'synced');

    const importedTransactions = dashboard.transactions.flatMap((group) => group.items).filter((transaction) => transaction.merch === 'Plaid Imported Groceries');
    const pendingTransactions = dashboard.transactions.flatMap((group) => group.items).filter((transaction) => transaction.merch === 'Plaid Pending Coffee');
    const postedTransactions = dashboard.transactions.flatMap((group) => group.items).filter((transaction) => transaction.merch === 'Plaid Posted Coffee');

    assert.equal(importedTransactions.length, 1);
    assert.equal(importedTransactions[0].who, 'stephanie');
    assert.equal(importedTransactions[0].amt, -42.18);
    assert.equal(pendingTransactions.length, 0);
    assert.equal(postedTransactions.length, 1);
    assert.equal(postedTransactions[0].syncStatus, 'synced');
  } finally {
    global.fetch = originalFetch;
    resetMockDatabase();

    if (originalUseMockDb === undefined) {
      delete process.env.USE_MOCK_DB;
    } else {
      process.env.USE_MOCK_DB = originalUseMockDb;
    }

    if (originalClientId === undefined) {
      delete process.env.PLAID_CLIENT_ID;
    } else {
      process.env.PLAID_CLIENT_ID = originalClientId;
    }

    if (originalSecret === undefined) {
      delete process.env.PLAID_SECRET;
    } else {
      process.env.PLAID_SECRET = originalSecret;
    }

    if (originalRedirectUri === undefined) {
      delete process.env.PLAID_REDIRECT_URI;
    } else {
      process.env.PLAID_REDIRECT_URI = originalRedirectUri;
    }

    if (originalWebhookUrl === undefined) {
      delete process.env.PLAID_WEBHOOK_URL;
    } else {
      process.env.PLAID_WEBHOOK_URL = originalWebhookUrl;
    }
  }
});

test('handleApiRequest syncs plaid accounts even when the review import step was skipped', async () => {
  const originalUseMockDb = process.env.USE_MOCK_DB;
  const originalClientId = process.env.PLAID_CLIENT_ID;
  const originalSecret = process.env.PLAID_SECRET;
  const originalRedirectUri = process.env.PLAID_REDIRECT_URI;
  const originalWebhookUrl = process.env.PLAID_WEBHOOK_URL;
  const originalFetch = global.fetch;
  process.env.USE_MOCK_DB = '1';
  process.env.PLAID_CLIENT_ID = 'test-client';
  process.env.PLAID_SECRET = 'test-secret';
  process.env.PLAID_REDIRECT_URI = 'https://example.com/plaid/oauth';
  process.env.PLAID_WEBHOOK_URL = 'https://example.com/plaid/webhook';
  resetMockDatabase();

  global.fetch = async (url, options) => {
    const path = String(url);
    const body = JSON.parse(options.body);

    if (path.endsWith('/item/public_token/exchange')) {
      assert.equal(body.public_token, 'public-token-456');
      return createFetchResponse({
        access_token: 'access-token-456',
        item_id: 'item-456',
        request_id: 'request-exchange',
      });
    }

    if (path.endsWith('/accounts/get')) {
      assert.equal(body.access_token, 'access-token-456');
      return createFetchResponse({
        accounts: [
          {
            account_id: 'account-1',
            name: 'Plaid Checking',
            official_name: 'Plaid Gold Standard 0% Interest Checking',
            mask: '0000',
            type: 'depository',
            subtype: 'checking',
            balances: { current: 512.34, available: 500.12 },
          },
        ],
      });
    }

    if (path.endsWith('/transactions/sync')) {
      assert.equal(body.access_token, 'access-token-456');
      return createFetchResponse({
        added: [
          {
            transaction_id: 'txn-456',
            account_id: 'account-1',
            amount: 18.25,
            date: '2026-05-10',
            merchant_name: 'Plaid Imported Coffee',
            name: 'Plaid Imported Coffee',
            category: ['Coffee Shops'],
            personal_finance_category: {
              primary: 'FOOD_AND_DRINK',
              detailed: 'FOOD_AND_DRINK_COFFEE',
            },
            pending: false,
          },
        ],
        modified: [],
        removed: [],
        next_cursor: 'cursor-456',
        has_more: false,
        accounts: [{ account_id: 'account-1' }],
        transactions_update_status: 'HISTORICAL_UPDATE_COMPLETE',
      });
    }

    if (path.endsWith('/liabilities/get')) {
      assert.equal(body.access_token, 'access-token-456');
      return createFetchResponse({
        accounts: [
          {
            account_id: 'account-1',
            balances: {
              current: 512.34,
              limit: null,
              available: 500.12,
              iso_currency_code: 'USD',
            },
            mask: '0000',
            name: 'Plaid Checking',
            official_name: 'Plaid Gold Standard 0% Interest Checking',
            subtype: 'checking',
            type: 'depository',
          },
          {
            account_id: 'account-2',
            balances: {
              current: 88.76,
              limit: 5000,
              available: null,
              iso_currency_code: 'USD',
            },
            mask: '1111',
            name: 'Plaid Credit Card',
            official_name: 'Plaid Diamond Credit Card',
            subtype: 'credit card',
            type: 'credit',
          },
        ],
        liabilities: {
          credit: [
            {
              account_id: 'account-2',
              aprs: [
                {
                  apr_percentage: 22.99,
                  apr_type: 'purchase_apr',
                  balance_subject_to_apr: 88.76,
                  interest_charge_amount: 1.42,
                },
              ],
              is_overdue: false,
              last_payment_amount: 35,
              last_payment_date: '2026-05-03',
              last_statement_issue_date: '2026-05-01',
              last_statement_balance: 123.45,
              minimum_payment_amount: 35,
              next_payment_due_date: '2026-05-18',
            },
          ],
          mortgage: [],
          student: [],
        },
      });
    }

    throw new Error(`Unexpected fetch URL: ${path}`);
  };

  try {
    const exchangeResponse = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'POST',
        url: '/api/plaid/exchange',
        body: {
          publicToken: 'public-token-456',
          selectedAccountIds: ['account-1'],
          ownerSlug: 'john',
          institutionName: 'Plaid Credit Union',
          linkSessionId: 'link-session-456',
        },
      }),
      exchangeResponse,
    );

    assert.equal(exchangeResponse.statusCode, 200);

    const syncData = await syncPlaidData({
      householdId: 1,
      itemId: 'item-456',
    });
    assert.equal(syncData.accountsUpdated, 1);
    assert.equal(syncData.transactionsImported, 1);

    const dashboard = await getDashboardData();
    const plaidAccount = dashboard.accounts.flatMap((group) => group.items).find((account) => account.externalAccountId === 'account-1');
    const plaidTransaction = dashboard.transactions.flatMap((group) => group.items).find((transaction) => transaction.merch === 'Plaid Imported Coffee');
    const plaidBill = dashboard.bills.find((bill) => bill.externalAccountId === 'account-2');
    const plaidDebt = dashboard.debts.find((debt) => debt.externalAccountId === 'account-2');

    assert.ok(plaidAccount);
    assert.equal(plaidAccount.externalProvider, 'plaid');
    assert.equal(plaidAccount.externalItemId, 'item-456');
    assert.equal(plaidAccount.name, 'Plaid Checking');
    assert.equal(plaidAccount.bal, 512.34);
    assert.equal(plaidAccount.syncStatus, 'synced');
    assert.ok(plaidTransaction);
    assert.equal(plaidTransaction.who, 'john');
    assert.ok(plaidBill);
    assert.equal(plaidBill.externalProvider, 'plaid');
    assert.equal(plaidBill.amt, 35);
    assert.ok(plaidBill.sub.includes('Minimum due'));
    assert.ok(plaidDebt);
    assert.equal(plaidDebt.externalProvider, 'plaid');
    assert.equal(plaidDebt.currentBalance, 88.76);
    assert.equal(plaidDebt.creditLimit, 5000);
    assert.equal(plaidDebt.minimumPaymentAmount, 35);
    assert.equal(plaidDebt.apr, 22.99);
  } finally {
    global.fetch = originalFetch;
    resetMockDatabase();

    if (originalUseMockDb === undefined) {
      delete process.env.USE_MOCK_DB;
    } else {
      process.env.USE_MOCK_DB = originalUseMockDb;
    }

    if (originalClientId === undefined) {
      delete process.env.PLAID_CLIENT_ID;
    } else {
      process.env.PLAID_CLIENT_ID = originalClientId;
    }

    if (originalSecret === undefined) {
      delete process.env.PLAID_SECRET;
    } else {
      process.env.PLAID_SECRET = originalSecret;
    }

    if (originalRedirectUri === undefined) {
      delete process.env.PLAID_REDIRECT_URI;
    } else {
      process.env.PLAID_REDIRECT_URI = originalRedirectUri;
    }

    if (originalWebhookUrl === undefined) {
      delete process.env.PLAID_WEBHOOK_URL;
    } else {
      process.env.PLAID_WEBHOOK_URL = originalWebhookUrl;
    }
  }
});
