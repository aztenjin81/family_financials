import assert from 'node:assert/strict';
import test from 'node:test';
import { getDashboardData } from '../scripts/dashboard-query.mjs';

test('dashboard query returns the Czechowski household data shape', async () => {
  const data = await getDashboardData();

  assert.equal(data.family, 'The Czechowski Family');
  assert.equal(data.asOfDate, '2026-05-11');
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

test('dashboard query exposes real household members and merchant suggestions', async () => {
  const data = await getDashboardData();

  assert.deepEqual(data.householdMembers.map((member) => member.slug), [
    'john',
    'stephanie',
    'kristen',
    'jason',
    'lauren',
    'ian',
  ]);
  assert.ok(data.merchantSuggestions.includes('Whole Foods Market'));
});

test('dashboard query exposes transaction ids for delete actions', async () => {
  const data = await getDashboardData();
  const transaction = data.transactions.flatMap((group) => group.items)[0];

  assert.equal(typeof transaction.id, 'number');
  assert.ok(transaction.id > 0);
});

test('dashboard query exposes stable chore ids for write actions', async () => {
  const data = await getDashboardData();
  const chores = data.kids.flatMap((kid) => kid.chores);

  assert.ok(chores.length > 0);
  assert.equal(typeof chores[0].id, 'number');
});
