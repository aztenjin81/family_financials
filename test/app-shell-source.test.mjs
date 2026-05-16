import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('transaction modal wires merchant input to dashboard merchant suggestions', () => {
  const source = fs.readFileSync('src/layout/AppShell.jsx', 'utf8');

  assert.match(source, /list="merchant-suggestions"/);
  assert.match(source, /<datalist id="merchant-suggestions">/);
  assert.match(source, /dashboardData\.merchantSuggestions/);
  assert.match(source, /buildMerchantAutofillMap/);
  assert.match(source, /getMerchantAutofill/);
  assert.match(source, /merchantAutofillMap/);
  assert.match(source, /type="date"/);
  assert.match(source, /postedDate/);
  assert.match(source, /parseTransactionDateLabel/);
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

test('transaction rows expose a delete action wired to the api', () => {
  const shell = fs.readFileSync('src/sections.jsx', 'utf8');
  const state = fs.readFileSync('src/app/AppState.jsx', 'utf8');

  assert.match(shell, /txn-edit/);
  assert.match(shell, /txn-delete/);
  assert.match(shell, /window\.confirm/);
  assert.match(shell, /Edit \${t\.merch}/);
  assert.match(shell, /Delete \${transaction\.merch}\?/);
  assert.match(shell, /postedDate: group\.date/);
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

test('page boundary forwards shell callbacks into the dashboard page', () => {
  const app = fs.readFileSync('src/App.jsx', 'utf8');

  assert.match(app, /function CurrentPage\(props\)/);
  assert.match(app, /<OverviewPage \{\.\.\.props\} \/>/);
  assert.match(app, /<PlaceholderPage page=\{activePage\} \{\.\.\.props\} \/>/);
});

test('app shell shows a visible indicator when fixture data is active', () => {
  const source = fs.readFileSync('src/layout/AppShell.jsx', 'utf8');

  assert.match(source, /dashboardSource/);
  assert.match(source, /dashboardSource === 'fixture'/);
  assert.match(source, /className="fallback-banner"/);
  assert.match(source, /Using demo data until the local database API is available\./);
});
