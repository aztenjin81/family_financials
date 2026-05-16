export function countDashboardAccounts(dashboardData) {
  return (dashboardData.accounts ?? []).reduce((count, group) => {
    return count + (group.items?.length ?? 0);
  }, 0);
}

export function formatAccountCount(count) {
  return `${count} ${count === 1 ? 'account' : 'accounts'}`;
}
