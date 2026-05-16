function normalizeMerchant(merchant) {
  return String(merchant || '').trim().toLowerCase();
}

export function buildMerchantAutofillMap(transactions = []) {
  const history = new Map();

  for (const group of transactions) {
    for (const transaction of group.items || []) {
      const key = normalizeMerchant(transaction.merch);

      if (!key) {
        continue;
      }

      const id = Number(transaction.id || 0);
      const current = history.get(key);
      const next = {
        category: transaction.cat || '',
        memberSlug: transaction.who || '',
        emoji: transaction.emoji || '',
        id,
      };

      if (!current || next.id >= current.id) {
        history.set(key, next);
      }
    }
  }

  return history;
}

export function getMerchantAutofill(history, merchant) {
  const key = normalizeMerchant(merchant);

  if (!key) {
    return null;
  }

  return history.get(key) || null;
}
