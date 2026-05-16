import assert from 'node:assert/strict';
import test from 'node:test';

import { DATA } from '../src/data.js';
import { countDashboardAccounts, formatAccountCount } from '../src/lib/accounts.js';

test('counts all dashboard account rows across groups', () => {
  assert.equal(countDashboardAccounts(DATA), 14);
});

test('formats account count with singular and plural labels', () => {
  assert.equal(formatAccountCount(1), '1 account');
  assert.equal(formatAccountCount(14), '14 accounts');
});
