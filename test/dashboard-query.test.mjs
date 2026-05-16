import assert from 'node:assert/strict';
import test from 'node:test';
import { getDashboardData } from '../scripts/dashboard-query.mjs';

test('dashboard query returns the Czechowski household data shape', async () => {
  const data = await getDashboardData();

  assert.equal(data.family, 'The Czechowski Family');
  assert.equal(data.asOf, 'Monday, May 11, 2026');
  assert.ok(data.accounts.length > 0);
  assert.ok(data.transactions.length > 0);
  assert.ok(data.kids.length > 0);
  assert.equal(data.netWorth.total, 487420);
});

test('dashboard query exposes John-facing account data', async () => {
  const data = await getDashboardData();
  const accountNames = data.accounts.flatMap((group) => group.items.map((item) => item.name));

  assert.ok(accountNames.includes('Fidelity 401(k) — John'));
  assert.equal(accountNames.some((name) => name.includes('Alex')), false);
});
