export function getBudgetStatus(spent, budget) {
  if (!Number.isFinite(spent) || !Number.isFinite(budget) || budget <= 0) {
    return { key: 'unknown', label: 'Budget unavailable', tagClass: 'warn' };
  }

  const ratio = spent / budget;

  if (ratio >= 1) {
    return { key: 'over', label: 'Over budget', tagClass: 'alert' };
  }

  if (ratio >= 0.9) {
    return { key: 'warning', label: 'Close to budget', tagClass: 'warn' };
  }

  return { key: 'on-track', label: 'On track', tagClass: 'ok' };
}
