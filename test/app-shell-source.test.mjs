import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('transaction modal wires merchant input to dashboard merchant suggestions', () => {
  const source = fs.readFileSync('src/layout/AppShell.jsx', 'utf8');

  assert.match(source, /list="merchant-suggestions"/);
  assert.match(source, /<datalist id="merchant-suggestions">/);
  assert.match(source, /dashboardData\.merchantSuggestions/);
});

test('transaction rows expose a delete action wired to the api', () => {
  const shell = fs.readFileSync('src/sections.jsx', 'utf8');
  const state = fs.readFileSync('src/app/AppState.jsx', 'utf8');

  assert.match(shell, /txn-delete/);
  assert.match(shell, /window\.confirm/);
  assert.match(shell, /Delete \${transaction\.merch}\?/);
  assert.match(state, /async function deleteTransaction/);
  assert.match(state, /\/api\/transactions\/\$\{transactionId\}/);
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

test('app shell shows a visible indicator when fixture data is active', () => {
  const source = fs.readFileSync('src/layout/AppShell.jsx', 'utf8');

  assert.match(source, /dashboardSource/);
  assert.match(source, /dashboardSource === 'fixture'/);
  assert.match(source, /className="fallback-banner"/);
  assert.match(source, /Using demo data until the local database API is available\./);
});
