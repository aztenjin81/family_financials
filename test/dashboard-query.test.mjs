import assert from 'node:assert/strict';
import test from 'node:test';
import { DATA } from '../src/data.js';
import { getAgeFromBirthDate } from '../src/lib/age.js';
import { getDashboardData } from '../scripts/dashboard-query.mjs';
import { resetMockDatabase } from '../scripts/mock-db.mjs';

process.env.USE_MOCK_DB = '1';

test('dashboard query returns the Czechowski household data shape', async () => {
  const data = await getDashboardData();

  assert.equal(data.family, 'The Czechowski Family');
  assert.equal(data.asOfDate, '2026-05-11');
  assert.equal(data.asOf, 'Monday, May 11, 2026');
  assert.ok(Array.isArray(data.accounts));
  assert.ok(data.transactions.length > 0);
  assert.ok(data.kids.length > 0);
  assert.equal(data.netWorth.total, 487420);
});

test('dashboard query exposes linked account rows', async () => {
  const data = await getDashboardData();

  assert.ok(Array.isArray(data.accounts));
  const account = data.accounts.flatMap((group) => group.items)[0];

  if (account) {
    assert.equal(typeof account.id, 'number');
    assert.ok(account.id > 0);
  } else {
    assert.equal(account, undefined);
  }
});

test('dashboard query exposes account ids for edit actions when plaid accounts exist', async () => {
  const data = await getDashboardData();
  const account = data.accounts.flatMap((group) => group.items)[0];

  if (account) {
    assert.equal(typeof account.id, 'number');
    assert.ok(account.id > 0);
  } else {
    assert.equal(account, undefined);
  }
});

test('dashboard query exposes spending category ids for budget edits', async () => {
  const data = await getDashboardData();

  assert.equal(typeof data.spending[0].id, 'number');
  assert.ok(data.spending[0].id > 0);
});

test('dashboard query exposes bill ids and status values for bill edits', async () => {
  const data = await getDashboardData();

  assert.ok(data.bills.length > 0);
  assert.equal(typeof data.bills[0].id, 'number');
  assert.ok(data.bills[0].id > 0);
  assert.ok(['upcoming', 'paid', 'snoozed'].includes(data.bills[0].status));
});

test('dashboard query exposes investment holding ids and calculated portfolio changes', async () => {
  const data = await getDashboardData();

  assert.ok(data.investments.holdings.length > 0);
  assert.equal(typeof data.investments.holdings[0].id, 'number');
  assert.ok(data.investments.holdings[0].id > 0);
  assert.notEqual(data.investments.delta, 0);
  assert.notEqual(data.investments.deltaPct, 0);
});

test('dashboard query exposes debt ids and payoff projections', async () => {
  const data = await getDashboardData();

  assert.ok(data.debts.length > 0);
  assert.equal(typeof data.debts[0].id, 'number');
  assert.ok(data.debts[0].id > 0);
  assert.ok(['projected', 'warning', 'unknown', 'paid'].includes(data.debts[0].status));
  assert.ok('remaining' in data.debts[0]);
});

test('dashboard query exposes goal ids for goal edits', async () => {
  const data = await getDashboardData();

  assert.ok(data.goals.length > 0);
  assert.equal(typeof data.goals[0].id, 'number');
  assert.ok(data.goals[0].id > 0);
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
  assert.ok(data.merchantSuggestions.length > 0);
  assert.ok(data.merchantSuggestions.includes(data.transactions.flatMap((group) => group.items)[0].merch));
});

test('dashboard query derives displayed ages from stored birth dates', async () => {
  const data = await getDashboardData();
  const expectedAges = new Map(DATA.members.map((member) => [member.slug, getAgeFromBirthDate(member.birthDate)]));

  for (const member of data.householdMembers) {
    assert.equal(member.age, expectedAges.get(member.slug));
    assert.equal(typeof member.birthDate, 'string');
  }

  for (const kid of data.kids) {
    assert.equal(kid.age, expectedAges.get(kid.who));
    assert.equal(typeof kid.birthDate, 'string');
  }
});

test('dashboard query exposes transaction ids for delete actions', async () => {
  const data = await getDashboardData();
  const transaction = data.transactions.flatMap((group) => group.items)[0];

  assert.equal(typeof transaction.id, 'number');
  assert.ok(transaction.id > 0);
  assert.ok('syncStatus' in transaction);
});

test('dashboard query exposes stable chore ids for write actions', async () => {
  const data = await getDashboardData();
  const chores = data.kids.flatMap((kid) => kid.chores);

  assert.ok(chores.length > 0);
  assert.equal(typeof chores[0].id, 'number');
});

test('dashboard query exposes allowance history and weekly payout details', async () => {
  resetMockDatabase();
  const data = await getDashboardData();

  assert.equal(typeof data.allowance.weeklyAmount, 'number');
  assert.equal(data.allowance.weeklyAmount, 5);
  assert.ok(Array.isArray(data.allowanceHistory));
  assert.ok(data.allowanceHistory.length > 0);
  assert.equal(data.allowanceHistory[0].entries.length, data.kids.length);
  assert.equal(typeof data.allowanceHistory[0].total, 'number');
  assert.equal(data.kids[0].weeklyAllowance, data.allowance.weeklyAmount);
});

test('dashboard query reflects household allowance edits after update', async () => {
  const { payWeeklyAllowance, updateHouseholdAllowance } = await import('../scripts/allowance-commands.mjs');

  resetMockDatabase();
  await updateHouseholdAllowance({ weeklyAmount: 6 });
  const updated = await getDashboardData();
  await updateHouseholdAllowance({ weeklyAmount: 5 });

  assert.equal(updated.allowance.weeklyAmount, 6);
  assert.equal(updated.kids[0].weeklyAllowance, 6);

  const payout = await payWeeklyAllowance();
  assert.equal(payout.allowancePayment.entries[0].weeklyAmount, 5);
});

test('dashboard query reflects a voided allowance batch as a reversal entry', async () => {
  const { payWeeklyAllowance, voidLatestAllowancePayment } = await import('../scripts/allowance-commands.mjs');

  resetMockDatabase();
  await payWeeklyAllowance();
  const reversed = await voidLatestAllowancePayment();
  const after = await getDashboardData();

  assert.equal(reversed.allowanceReversal.total, -after.kids.length * 5);
  assert.match(after.allowanceHistory[0].label, /Reversal/);
  assert.equal(after.kids[0].weeklyAllowance, 5);
});
