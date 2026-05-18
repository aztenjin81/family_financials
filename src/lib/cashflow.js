export function getCashflowStatus(cashflow) {
  const incoming = Number(cashflow?.incoming);
  const outgoing = Number(cashflow?.outgoing);
  const net = Number.isFinite(Number(cashflow?.net))
    ? Number(cashflow.net)
    : incoming - outgoing;

  if (!Number.isFinite(incoming) || !Number.isFinite(outgoing) || !Number.isFinite(net)) {
    return { key: 'unknown', label: 'Cashflow unavailable', tagClass: 'warn' };
  }

  if (net <= 0) {
    return { key: 'negative', label: 'Cashflow negative', tagClass: 'alert' };
  }

  const cushion = outgoing > 0 ? net / outgoing : 1;

  if (cushion < 0.15 || net < 500) {
    return { key: 'tight', label: 'Thin cushion', tagClass: 'warn' };
  }

  return { key: 'healthy', label: 'Healthy', tagClass: 'ok' };
}

export function getCashflowStartingBalance(accounts = [], transactions = []) {
  if (!Array.isArray(accounts)) {
    return 0;
  }

  const cashAccountIds = new Set();
  let total = 0;

  for (const entry of accounts) {
    if (Array.isArray(entry?.items)) {
      if (String(entry.group || '').toLowerCase() !== 'cash') {
        continue;
      }

      for (const account of entry.items) {
        total += Number(account?.bal ?? account?.balance ?? 0);
        const externalAccountId = String(account?.externalAccountId || account?.external_account_id || '').trim();
        if (externalAccountId) {
          cashAccountIds.add(externalAccountId);
        }
      }
      continue;
    }

    const group = String(entry?.group ?? entry?.account_group ?? '').toLowerCase();
    if (group && group !== 'cash') {
      continue;
    }

    total += Number(entry?.bal ?? entry?.balance ?? 0);
    const externalAccountId = String(entry?.externalAccountId || entry?.external_account_id || '').trim();
    if (externalAccountId) {
      cashAccountIds.add(externalAccountId);
    }
  }

  if (!Array.isArray(transactions) || cashAccountIds.size === 0) {
    return total;
  }

  for (const transaction of transactions) {
    if (String(transaction?.syncStatus || transaction?.sync_status || '').toLowerCase() !== 'pending') {
      continue;
    }

    const externalAccountId = String(transaction?.externalAccountId || transaction?.external_account_id || '').trim();
    if (!externalAccountId || !cashAccountIds.has(externalAccountId)) {
      continue;
    }

    total += Number(transaction?.amt ?? transaction?.amount ?? 0);
  }

  return Math.round(total * 100) / 100;
}
