import assert from 'node:assert/strict';
import test from 'node:test';

import { DATA } from '../src/data.js';
import { countDashboardAccounts, formatAccountCount } from '../src/lib/accounts.js';
import { getBudgetStatus } from '../src/lib/budget.js';

test('counts all dashboard account rows across groups', () => {
  assert.equal(countDashboardAccounts(DATA), 14);
});

test('formats account count with singular and plural labels', () => {
  assert.equal(formatAccountCount(1), '1 account');
  assert.equal(formatAccountCount(14), '14 accounts');
});

test('classifies monthly budget status from spend and budget totals', () => {
  assert.deepEqual(getBudgetStatus(6842, 9200), {
    key: 'on-track',
    label: 'On track',
    tagClass: 'ok',
  });
  assert.deepEqual(getBudgetStatus(8820, 9200), {
    key: 'warning',
    label: 'Close to budget',
    tagClass: 'warn',
  });
  assert.deepEqual(getBudgetStatus(9201, 9200), {
    key: 'over',
    label: 'Over budget',
    tagClass: 'alert',
  });
});
