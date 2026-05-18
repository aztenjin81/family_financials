export function countDashboardAccounts(dashboardData) {
  return (dashboardData.accounts ?? []).reduce((count, group) => {
    return count + (group.items?.length ?? 0);
  }, 0);
}

export function countLinkedPlaidItems(dashboardData) {
  const plaidItemIds = new Set();

  for (const group of dashboardData.accounts ?? []) {
    for (const account of group.items ?? []) {
      if (account.externalItemId) {
        plaidItemIds.add(String(account.externalItemId));
      }
    }
  }

  return plaidItemIds.size;
}

export function formatAccountCount(count) {
  return `${count} ${count === 1 ? 'account' : 'accounts'}`;
}

export function formatPlaidItemCount(count) {
  return `${count} ${count === 1 ? 'item' : 'items'}`;
}

export function getPlaidPendingTransactionTotal(dashboardData, externalAccountId) {
  const targetAccountId = String(externalAccountId || '').trim();

  if (!targetAccountId) {
    return 0;
  }

  let total = 0;

  for (const group of dashboardData?.transactions ?? []) {
    for (const transaction of group?.items ?? []) {
      if (String(transaction?.syncStatus || '').toLowerCase() !== 'pending') {
        continue;
      }

      if (String(transaction?.externalAccountId || '').trim() !== targetAccountId) {
        continue;
      }

      total += Number(transaction?.amt ?? 0);
    }
  }

  return Math.round(total * 100) / 100;
}

export function getSpendableBalance(account, dashboardData) {
  const current = Number(account?.bal ?? account?.balance ?? 0);

  if (String(account?.externalProvider || '').toLowerCase() !== 'plaid') {
    return Math.round(current * 100) / 100;
  }

  return Math.round((current + getPlaidPendingTransactionTotal(dashboardData, account?.externalAccountId)) * 100) / 100;
}

function getLatestImportedAt(dashboardData) {
  let latest = null;

  for (const group of dashboardData.accounts ?? []) {
    for (const account of group.items ?? []) {
      if (!account.importedAt) {
        continue;
      }

      const importedAt = new Date(account.importedAt);
      if (Number.isNaN(importedAt.getTime())) {
        continue;
      }

      if (!latest || importedAt > latest) {
        latest = importedAt;
      }
    }
  }

  return latest;
}

export function formatAccountSyncAge(dashboardData, now = new Date()) {
  const latest = getLatestImportedAt(dashboardData);

  if (!latest) {
    return 'never synced';
  }

  const elapsedMs = Math.max(0, now.getTime() - latest.getTime());

  if (elapsedMs < 60_000) {
    return 'just now';
  }

  if (elapsedMs < 3_600_000) {
    const minutes = Math.floor(elapsedMs / 60_000);
    return `${minutes} min ago`;
  }

  if (elapsedMs < 86_400_000) {
    const hours = Math.floor(elapsedMs / 3_600_000);
    return `${hours}h ago`;
  }

  const days = Math.floor(elapsedMs / 86_400_000);
  return `${days}d ago`;
}
