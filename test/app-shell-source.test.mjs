import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('transaction modal wires merchant input to dashboard merchant suggestions', () => {
  const source = fs.readFileSync('src/layout/AppShell.jsx', 'utf8');

  assert.match(source, /list="merchant-suggestions"/);
  assert.match(source, /<datalist id="merchant-suggestions">/);
  assert.match(source, /dashboardData\.merchantSuggestions/);
  assert.match(source, /buildMerchantAutofillMap/);
  assert.match(source, /buildTransactionCategoryOptions/);
  assert.match(source, /transactionCategoryOptions/);
  assert.match(source, /getMerchantAutofill/);
  assert.match(source, /merchantAutofillMap/);
  assert.match(source, /type="date"/);
  assert.match(source, /postedDate/);
  assert.match(source, /parseTransactionDateLabel/);
  assert.match(source, /list="transaction-categories"/);
  assert.match(source, /<datalist id="transaction-categories">/);
  assert.doesNotMatch(source, /<option>Groceries<\/option>/);
  assert.doesNotMatch(source, /<option>Dining out<\/option>/);
});

test('account modal wires account controls to dashboard account data', () => {
  const source = fs.readFileSync('src/layout/AppShell.jsx', 'utf8');
  const sections = fs.readFileSync('src/sections.jsx', 'utf8');

  assert.match(source, /Add account/);
  assert.match(source, /accountOpen/);
  assert.match(source, /accountMode === 'edit'/);
  assert.match(source, /Save account/);
  assert.match(source, /Update account/);
  assert.match(sections, /onAddAccount/);
  assert.match(sections, /onEditAccount/);
  assert.match(sections, /Edit \${a\.name}/);
});

test('goal modal wires goal controls to dashboard goal data', () => {
  const source = fs.readFileSync('src/layout/AppShell.jsx', 'utf8');
  const sections = fs.readFileSync('src/sections.jsx', 'utf8');
  const overview = fs.readFileSync('src/pages/OverviewPage.jsx', 'utf8');

  assert.match(source, /goalOpen/);
  assert.match(source, /goalMode === 'edit'/);
  assert.match(source, /goalColorOptions/);
  assert.match(source, /goal-colors/);
  assert.match(source, /Save goal/);
  assert.match(source, /Update goal/);
  assert.match(source, /onAddGoal: openGoalModal/);
  assert.match(source, /onEditGoal: openGoalModal/);
  assert.match(sections, /onAddGoal/);
  assert.match(sections, /onEditGoal/);
  assert.match(sections, /Edit \${g\.name}/);
  assert.match(sections, /goal-edit/);
  assert.match(overview, /onAddGoal/);
  assert.match(overview, /onEditGoal/);
});

test('bill modal wires bill controls to dashboard bill data', () => {
  const source = fs.readFileSync('src/layout/AppShell.jsx', 'utf8');
  const sections = fs.readFileSync('src/sections.jsx', 'utf8');
  const overview = fs.readFileSync('src/pages/OverviewPage.jsx', 'utf8');

  assert.match(source, /billOpen/);
  assert.match(source, /billMode === 'edit'/);
  assert.match(source, /addBill/);
  assert.match(source, /updateBill/);
  assert.match(source, /setBillStatus/);
  assert.match(source, /Save bill/);
  assert.match(source, /Update bill/);
  assert.match(source, /onAddBill: openBillModal/);
  assert.match(source, /onEditBill: openBillModal/);
  assert.match(source, /onSetBillStatus: changeBillStatus/);
  assert.match(sections, /onAddBill/);
  assert.match(sections, /onEditBill/);
  assert.match(sections, /onSetBillStatus/);
  assert.match(sections, /bill-edit/);
  assert.match(sections, /Mark paid/);
  assert.match(sections, /Snooze/);
  assert.match(overview, /BillsCard/);
  assert.match(overview, /onAddBill/);
  assert.match(overview, /onEditBill/);
  assert.match(overview, /onSetBillStatus/);
});

test('debt modal wires debt controls to dashboard debt data', () => {
  const source = fs.readFileSync('src/layout/AppShell.jsx', 'utf8');
  const sections = fs.readFileSync('src/sections.jsx', 'utf8');
  const overview = fs.readFileSync('src/pages/OverviewPage.jsx', 'utf8');

  assert.match(source, /debtOpen/);
  assert.match(source, /debtMode === 'edit'/);
  assert.match(source, /addDebt/);
  assert.match(source, /updateDebt/);
  assert.match(source, /Save debt/);
  assert.match(source, /Update debt/);
  assert.match(source, /onAddDebt: openDebtModal/);
  assert.match(source, /onEditDebt: openDebtModal/);
  assert.match(sections, /onAddDebt/);
  assert.match(sections, /onEditDebt/);
  assert.match(sections, /debt-edit/);
  assert.match(sections, /Est\. payoff/);
  assert.match(sections, /Payment too low to retire balance/);
  assert.match(overview, /onAddDebt/);
  assert.match(overview, /onEditDebt/);
});

test('investment modal wires holding controls to dashboard holding data', () => {
  const source = fs.readFileSync('src/layout/AppShell.jsx', 'utf8');
  const sections = fs.readFileSync('src/sections.jsx', 'utf8');
  const overview = fs.readFileSync('src/pages/OverviewPage.jsx', 'utf8');

  assert.match(source, /investmentOpen/);
  assert.match(source, /investmentId/);
  assert.match(source, /updateInvestmentHolding/);
  assert.match(source, /Edit holding/);
  assert.match(source, /Update holding/);
  assert.match(source, /onEditInvestment: openInvestmentModal/);
  assert.match(sections, /onEditInvestment/);
  assert.match(sections, /Edit \${h\.tk}/);
  assert.match(sections, /inv-edit/);
  assert.match(overview, /onEditInvestment/);
});

test('transaction rows expose a delete action wired to the api', () => {
  const shell = fs.readFileSync('src/sections.jsx', 'utf8');
  const transactionsPage = fs.readFileSync('src/pages/TransactionsPage.jsx', 'utf8');
  const state = fs.readFileSync('src/app/AppState.jsx', 'utf8');

  assert.match(shell, /txn-edit/);
  assert.match(shell, /txn-delete/);
  assert.match(shell, /Latest 10 <em>transactions<\/em>/);
  assert.match(shell, /slice\(0, 10\)/);
  assert.match(shell, /onViewAll/);
  assert.match(shell, /link-arrow/);
  assert.match(shell, /window\.confirm/);
  assert.match(shell, /Edit \${t\.merch}/);
  assert.match(shell, /Delete \${transaction\.merch}\?/);
  assert.match(shell, /postedDate: group\.date/);
  assert.match(shell, /syncStatus === 'pending'/);
  assert.match(shell, /Pending/);
  assert.match(transactionsPage, /syncStatus === 'pending'/);
  assert.match(transactionsPage, /Pending/);
  assert.match(transactionsPage, /txn-pending-note/);
  assert.match(transactionsPage, /Affects spendable balance by/);
  assert.match(state, /async function updateTransaction/);
  assert.match(state, /\/api\/transactions\/\$\{transactionId\}/);
  assert.match(state, /async function deleteTransaction/);
  assert.match(state, /requestJson\('\/api\/dashboard'\)/);
});

test('transaction modal renders household member options from dashboard data', () => {
  const source = fs.readFileSync('src/layout/AppShell.jsx', 'utf8');

  assert.match(source, /dashboardData\.householdMembers/);
  assert.match(source, /householdMembers\.map/);
});

test('transaction submission is not blocked by fixture dashboard state', () => {
  const source = fs.readFileSync('src/app/AppState.jsx', 'utf8');

  assert.doesNotMatch(source, /Transactions require the database API/);
  assert.match(source, /useCallback/);
  assert.match(source, /const refreshDashboard = useCallback/);
});

test('transaction modal switches copy when editing a transaction', () => {
  const source = fs.readFileSync('src/layout/AppShell.jsx', 'utf8');

  assert.match(source, /transactionMode === 'edit'/);
  assert.match(source, /Edit activity/);
  assert.match(source, /Update transaction/);
  assert.match(source, /openTransactionModal/);
});

test('net worth hero wires the selected range into the displayed history', () => {
  const source = fs.readFileSync('src/sections.jsx', 'utf8');

  assert.match(source, /getNetWorthWindow/);
  assert.match(source, /netWorthWindow\.history/);
  assert.match(source, /netWorthWindow\.total/);
  assert.match(source, /netWorthWindow\.delta/);
});

test('budget editing is wired from the insight action and category rows', () => {
  const shell = fs.readFileSync('src/layout/AppShell.jsx', 'utf8');
  const state = fs.readFileSync('src/app/AppState.jsx', 'utf8');
  const sections = fs.readFileSync('src/sections.jsx', 'utf8');

  assert.match(shell, /Adjust budget/);
  assert.match(shell, /openBudgetModal/);
  assert.match(shell, /updateSpendingBudget\(currentCategory \|\| budgetForm, Number\(budgetForm\.budget\)\)/);
  assert.match(shell, /budgetOpen/);
  assert.match(shell, /Save budget/);
  assert.match(state, /\/api\/spending-categories\/\$\{category\.id\}/);
  assert.match(state, /updateSpendingBudget/);
  assert.match(sections, /spend-edit/);
  assert.match(sections, /Adjust \${c\.cat} budget/);
});

test('kids allowance history and payout controls are wired into the dashboard', () => {
  const shell = fs.readFileSync('src/layout/AppShell.jsx', 'utf8');
  const sections = fs.readFileSync('src/sections.jsx', 'utf8');
  const kidsPage = fs.readFileSync('src/pages/KidsPage.jsx', 'utf8');

  assert.match(shell, /allowanceSaving/);
  assert.match(shell, /allowanceVoiding/);
  assert.match(shell, /allowanceError/);
  assert.match(shell, /handlePayWeeklyAllowance/);
  assert.match(shell, /handleVoidLatestAllowance/);
  assert.match(shell, /onAddChore: addChore/);
  assert.match(shell, /onUpdateWeeklyAllowance: handleUpdateWeeklyAllowance/);
  assert.match(sections, /Void latest payout/);
  assert.match(sections, /onVoidLatestAllowance/);
  assert.match(sections, /allowanceHistory/);
  assert.match(sections, /Pay weekly allowance/);
  assert.match(sections, /Hide history/);
  assert.match(sections, /Allowance history/);
  assert.match(sections, /kids-allowance-meta/);
  assert.match(sections, /Age-aware chore templates/);
  assert.match(sections, /getSuggestedChoreTemplates/);
  assert.match(sections, /onAddChore/);
  assert.match(sections, /Edit/);
  assert.match(sections, /Delete/);
  assert.match(sections, /Update chore/);
  assert.match(sections, /Add chore/);
  assert.match(kidsPage, /Allowance <em>center<\/em>/);
  assert.match(kidsPage, /KidsCard/);
  assert.match(kidsPage, /Weekly allowance amount/);
  assert.match(kidsPage, /Update allowance/);
  assert.match(kidsPage, /onAddChore/);
  assert.match(kidsPage, /onUpdateChore/);
  assert.match(kidsPage, /onDeleteChore/);
});

test('page boundary forwards shell callbacks into the dashboard page', () => {
  const app = fs.readFileSync('src/App.jsx', 'utf8');
  const shell = fs.readFileSync('src/layout/AppShell.jsx', 'utf8');
  const navigation = fs.readFileSync('src/lib/navigation.js', 'utf8');

  assert.match(app, /function CurrentPage\(props\)/);
  assert.match(app, /<OverviewPage \{\.\.\.props\} \/>/);
  assert.match(app, /<AccountsPage \{\.\.\.props\} \/>/);
  assert.match(app, /<GoalsPage \{\.\.\.props\} \/>/);
  assert.match(app, /<KidsPage \{\.\.\.props\} \/>/);
  assert.match(app, /<TransactionsPage \{\.\.\.props\} \/>/);
  assert.match(app, /<PlaceholderPage page=\{activePage\} \{\.\.\.props\} \/>/);
  assert.match(shell, /onAddTransaction: openTransactionModal/);
  assert.match(shell, /onAddChore: addChore/);
  assert.match(shell, /onAddGoal: openGoalModal/);
  assert.match(shell, /onAddDebt: openDebtModal/);
  assert.match(shell, /onOpenTransactions: \(\) => setActivePage\('transactions'\)/);
  assert.match(shell, /onPayWeeklyAllowance: handlePayWeeklyAllowance/);
  assert.match(navigation, /accent: 'items'/);
  assert.doesNotMatch(navigation, /accent: 'institutions'/);
});

test('app shell shows a visible indicator when fixture data is active', () => {
  const source = fs.readFileSync('src/layout/AppShell.jsx', 'utf8');

  assert.match(source, /dashboardSource/);
  assert.match(source, /dashboardSource === 'fixture'/);
  assert.match(source, /className="fallback-banner"/);
  assert.match(source, /Using demo data until the local database API is available\./);
});

test('account summary text is derived from dashboard data instead of hardcoded copy', () => {
  const shell = fs.readFileSync('src/layout/AppShell.jsx', 'utf8');
  const sections = fs.readFileSync('src/sections.jsx', 'utf8');

  assert.match(shell, /countDashboardAccounts/);
  assert.match(shell, /countLinkedPlaidItems/);
  assert.match(shell, /formatAccountSyncAge/);
  assert.match(shell, /formatPlaidItemCount/);
  assert.doesNotMatch(shell, /Last sync 4 min ago/);
  assert.doesNotMatch(shell, /11 accounts · 6 institutions/);
  assert.match(sections, /countLinkedPlaidItems/);
  assert.match(sections, /formatAccountSyncAge/);
  assert.match(sections, /formatPlaidItemCount/);
  assert.match(sections, /getCashflowStartingBalance/);
  assert.match(sections, /Anchored to spendable cash balance/);
});

test('overview exposes plaid sync in the accounts rail', () => {
  const overview = fs.readFileSync('src/pages/OverviewPage.jsx', 'utf8');
  const shell = fs.readFileSync('src/layout/AppShell.jsx', 'utf8');
  const sections = fs.readFileSync('src/sections.jsx', 'utf8');

  assert.match(overview, /onSyncPlaidAccounts/);
  assert.match(shell, /onSyncPlaidAccounts: syncPlaidAccounts/);
  assert.match(sections, /Sync Plaid/);
  assert.match(sections, /accounts-rail-actions/);
  assert.match(sections, /Pull fresh balances and transactions from Plaid\./);
});

test('goals page renders a dedicated summary view', () => {
  const goalsPage = fs.readFileSync('src/pages/GoalsPage.jsx', 'utf8');

  assert.match(goalsPage, /goals-summary-card/);
  assert.match(goalsPage, /goals-owner-card/);
  assert.match(goalsPage, /goalSummary/);
  assert.match(goalsPage, /onAddGoal/);
  assert.match(goalsPage, /onEditGoal/);
  assert.match(goalsPage, /GoalsCard/);
  assert.match(goalsPage, /Lowest-progress goal/);
});

test('accounts page wires Plaid Link and account review flow', () => {
  const accountsPage = fs.readFileSync('src/pages/AccountsPage.jsx', 'utf8');

  assert.match(accountsPage, /Connect with Plaid/);
  assert.match(accountsPage, /Sync Plaid accounts/);
  assert.match(accountsPage, /Reconnect/);
  assert.match(accountsPage, /Connect Plaid, then import balances, bills, and debt payoff details/);
  assert.match(accountsPage, /Imported household accounts/);
  assert.match(accountsPage, /accounts-summary--empty/);
  assert.match(accountsPage, /accounts-summary-note/);
  assert.match(accountsPage, /accounts-empty-panel/);
  assert.match(accountsPage, /No accounts imported yet/);
  assert.match(accountsPage, /Connect Plaid to pull in balances, bills, debt payoff details, ownership, and sync status for the household\./);
  assert.match(accountsPage, /Spendable/);
  assert.match(accountsPage, /Current/);
  assert.match(accountsPage, /Pending/);
  assert.match(accountsPage, /https:\/\/cdn\.plaid\.com\/link\/v2\/stable\/link-initialize\.js/);
  assert.match(accountsPage, /\/api\/plaid\/link-token/);
  assert.match(accountsPage, /\/api\/plaid\/exchange/);
  assert.match(accountsPage, /\/api\/plaid\/update-token/);
  assert.match(accountsPage, /\/api\/plaid\/review/);
  assert.match(accountsPage, /\/api\/plaid\/sync/);
  assert.match(accountsPage, /need attention/);
  assert.match(accountsPage, /Import selected accounts/);
  assert.match(accountsPage, /accounts-review-balance-stack/);
  assert.match(accountsPage, /accounts-review-balance-label/);
  assert.match(accountsPage, /accounts-review-balance-main/);
  assert.match(accountsPage, /accounts-review-balance-sub/);
  assert.match(accountsPage, /selectedAccountIds/);
  assert.match(accountsPage, /defaultOwnerSlug/);
  assert.match(accountsPage, /plaidHandlerRef/);
  assert.match(accountsPage, /plaid-groups/);
});

test('plaid webhook handling is wired to a dedicated verified endpoint', () => {
  const api = fs.readFileSync('scripts/api-handler.mjs', 'utf8');
  const plaid = fs.readFileSync('scripts/plaid-commands.mjs', 'utf8');

  assert.match(api, /\/api\/plaid\/webhook/);
  assert.match(api, /\/api\/plaid\/update-token/);
  assert.match(api, /\/api\/plaid\/review/);
  assert.match(api, /plaid-verification/);
  assert.match(plaid, /verifyPlaidWebhook/);
  assert.match(plaid, /webhook_verification_key\/get/);
  assert.match(plaid, /PLAID_WEBHOOK_URL/);
  assert.match(plaid, /createPlaidUpdateToken/);
  assert.match(plaid, /reviewPlaidItemAccounts/);
  assert.match(plaid, /account_selection_enabled: true/);
  assert.match(plaid, /transactions:\s*\{\s*days_requested:\s*730,?/);
  assert.match(plaid, /\/transactions\/sync/);
  assert.match(plaid, /SYNC_UPDATES_AVAILABLE/);
  assert.match(plaid, /LOGIN_REPAIRED/);
});
