const DEPOSITORY_CASH_SUBTYPES = new Set([
  'checking',
  'savings',
  'cash management',
  'cd',
  'money market',
  'prepaid',
  'paypal',
  'cash isa',
  'limited purpose checking',
]);

function normalizeText(value) {
  return String(value ?? '').trim();
}

export function mapPlaidAccountGroup(account) {
  const type = normalizeText(account?.type).toLowerCase();
  const subtype = normalizeText(account?.subtype).toLowerCase();

  if (type === 'credit') {
    return 'Credit';
  }

  if (type === 'investment' || type === 'brokerage') {
    return 'Investments';
  }

  if (type === 'loan') {
    return 'Property & Debt';
  }

  if (type === 'depository' && DEPOSITORY_CASH_SUBTYPES.has(subtype)) {
    return 'Cash';
  }

  return 'Cash';
}

export function mapPlaidAccountIcon(account) {
  const type = normalizeText(account?.type).toLowerCase();
  const subtype = normalizeText(account?.subtype).toLowerCase();

  if (type === 'credit') {
    return 'Card';
  }

  if (type === 'investment' || type === 'brokerage') {
    return 'Stock';
  }

  if (type === 'loan') {
    if (subtype === 'auto') {
      return 'Car';
    }

    return 'Home';
  }

  if (subtype === 'savings' || subtype === 'cash management' || subtype === 'money market' || subtype === 'cd') {
    return 'Vault';
  }

  return 'Bank';
}

export function formatPlaidAccountSubtitle(account) {
  const pieces = [];
  const officialName = normalizeText(account?.official_name);
  const mask = normalizeText(account?.mask);
  const subtype = normalizeText(account?.subtype);

  if (officialName) {
    pieces.push(officialName);
  }

  if (mask) {
    pieces.push(`••${mask}`);
  } else if (subtype) {
    pieces.push(subtype);
  }

  return pieces.join(' · ');
}

export function normalizePlaidBalance(account) {
  const current = account?.balances?.current;
  const available = account?.balances?.available;
  const rawBalance = Number(current ?? available ?? 0);
  const type = normalizeText(account?.type).toLowerCase();

  if (!Number.isFinite(rawBalance)) {
    return 0;
  }

  if (type === 'credit' || type === 'loan') {
    return -Math.abs(rawBalance);
  }

  return rawBalance;
}

export function buildPlaidAccountPreview({ account, itemId, provider = 'plaid', ownerSlug = 'john' }) {
  return {
    provider,
    externalItemId: itemId,
    externalAccountId: account.account_id,
    accountGroup: mapPlaidAccountGroup(account),
    name: account.name,
    subtitle: formatPlaidAccountSubtitle(account),
    icon: mapPlaidAccountIcon(account),
    balance: normalizePlaidBalance(account),
    ownerSlug,
    accountType: account.type || null,
    accountSubtype: account.subtype || null,
  };
}

function humanizePlaidLabel(value) {
  return String(value ?? '')
    .trim()
    .replaceAll('_', ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(\w)/g, (match) => match.toUpperCase());
}

export function formatPlaidTransactionMerchant(transaction) {
  return normalizeText(
    transaction?.merchant_name
    || transaction?.name
    || transaction?.original_description
    || 'Plaid transaction',
  );
}

export function formatPlaidTransactionCategory(transaction) {
  const categories = Array.isArray(transaction?.category) ? transaction.category : [];
  const detailed = normalizeText(transaction?.personal_finance_category?.detailed);
  const primary = normalizeText(transaction?.personal_finance_category?.primary);
  const rawCategory = normalizeText(categories[0] || detailed || primary);

  if (!rawCategory) {
    return 'Uncategorized';
  }

  if (rawCategory.includes(' ')) {
    return rawCategory;
  }

  return humanizePlaidLabel(rawCategory);
}

export function normalizePlaidTransactionAmount(transaction) {
  const amount = Number(transaction?.amount);

  if (!Number.isFinite(amount)) {
    return 0;
  }

  return -amount;
}

export function buildPlaidTransactionPreview({
  transaction,
  accountOwnerSlug = 'john',
  defaultCategory = 'Uncategorized',
}) {
  const amount = normalizePlaidTransactionAmount(transaction);
  const postedDate = normalizeText(transaction?.date);
  const pending = Boolean(transaction?.pending);

  return {
    merchant: formatPlaidTransactionMerchant(transaction),
    category: formatPlaidTransactionCategory(transaction) || defaultCategory,
    amount,
    memberSlug: accountOwnerSlug,
    postedDate,
    timeLabel: '',
    emoji: '•',
    isIncome: amount > 0,
    syncStatus: pending ? 'pending' : 'synced',
    pending,
    pendingTransactionId: transaction?.pending_transaction_id || null,
    externalTransactionId: transaction?.transaction_id || null,
    externalAccountId: transaction?.account_id || null,
  };
}
