import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('transaction modal wires merchant input to dashboard merchant suggestions', () => {
  const source = fs.readFileSync('src/layout/AppShell.jsx', 'utf8');

  assert.match(source, /list="merchant-suggestions"/);
  assert.match(source, /<datalist id="merchant-suggestions">/);
  assert.match(source, /dashboardData\.merchantSuggestions/);
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
