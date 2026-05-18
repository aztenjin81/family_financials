import assert from 'node:assert/strict';
import test from 'node:test';

import { DATA } from '../src/data.js';
import {
  countDashboardAccounts,
  countLinkedPlaidItems,
  formatAccountCount,
  formatAccountSyncAge,
  formatPlaidItemCount,
  getPlaidPendingTransactionTotal,
  getSpendableBalance,
} from '../src/lib/accounts.js';
import { getBudgetStatus } from '../src/lib/budget.js';

test('counts all dashboard account rows across groups', () => {
  assert.equal(countDashboardAccounts(DATA), 0);
});

test('formats account count with singular and plural labels', () => {
  assert.equal(formatAccountCount(1), '1 account');
  assert.equal(formatAccountCount(14), '14 accounts');
});

test('fixture data exposes the current demo account summary defaults', () => {
  assert.equal(countLinkedPlaidItems(DATA), 0);
  assert.equal(formatAccountSyncAge(DATA, new Date('2026-05-16T11:10:00.000Z')), 'never synced');
});

test('counts linked plaid items and formats the plaid item label', () => {
  const dashboardData = {
    accounts: [
      {
        items: [
          { externalItemId: 'item-1', importedAt: '2026-05-16T10:55:00.000Z' },
          { externalItemId: 'item-1', importedAt: '2026-05-16T10:50:00.000Z' },
        ],
      },
      {
        items: [
          { externalItemId: 'item-2', importedAt: '2026-05-16T10:40:00.000Z' },
          { externalItemId: null, importedAt: null },
        ],
      },
    ],
  };

  assert.equal(countLinkedPlaidItems(dashboardData), 2);
  assert.equal(formatPlaidItemCount(1), '1 item');
  assert.equal(formatPlaidItemCount(2), '2 items');
});

test('formats account sync age from the newest imported account timestamp', () => {
  const dashboardData = {
    accounts: [
      {
        items: [
          { importedAt: '2026-05-16T10:55:00.000Z' },
          { importedAt: '2026-05-16T10:40:00.000Z' },
        ],
      },
      {
        items: [{ importedAt: '2026-05-16T09:40:00.000Z' }],
      },
    ],
  };

  assert.equal(
    formatAccountSyncAge(dashboardData, new Date('2026-05-16T11:00:00.000Z')),
    '5 min ago',
  );
  assert.equal(
    formatAccountSyncAge({ accounts: [{ items: [{ importedAt: null }] }] }, new Date('2026-05-16T11:00:00.000Z')),
    'never synced',
  );
});

test('derives pending plaid adjustments and spendable balances from dashboard transactions', () => {
  const dashboardData = {
    transactions: [
      {
        items: [
          {
            syncStatus: 'pending',
            externalAccountId: 'cash-account-1',
            amt: -3.28,
          },
          {
            syncStatus: 'pending',
            externalAccountId: 'cash-account-1',
            amt: -30.07,
          },
          {
            syncStatus: 'synced',
            externalAccountId: 'cash-account-1',
            amt: -12,
          },
          {
            syncStatus: 'pending',
            externalAccountId: 'other-account',
            amt: -99,
          },
        ],
      },
    ],
  };

  const plaidAccount = {
    bal: 37.05,
    externalProvider: 'plaid',
    externalAccountId: 'cash-account-1',
  };

  assert.equal(getPlaidPendingTransactionTotal(dashboardData, 'cash-account-1'), -33.35);
  assert.equal(getSpendableBalance(plaidAccount, dashboardData), 3.7);
  assert.equal(getSpendableBalance({ bal: 84.2, externalProvider: 'manual' }, dashboardData), 84.2);
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
