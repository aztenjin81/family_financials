import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTransactionCategoryOptions, filterTransactionRows } from '../src/lib/transactions.js';

test('filters transaction rows by member, category, merchant, date, and amount range', () => {
  const groups = [
    {
      day: 'Today · Mon May 11',
      date: '2026-05-11',
      items: [
        {
          merch: 'Whole Foods Market',
          cat: 'Groceries',
          who: 'john',
          amt: -142.18,
          time: '11:42 AM',
          postedDate: '2026-05-11',
        },
        {
          merch: 'Blue Bottle Coffee',
          cat: 'Dining out',
          who: 'stephanie',
          amt: -6.75,
          time: '8:14 AM',
          postedDate: '2026-05-11',
        },
      ],
    },
    {
      day: 'Sun May 10',
      items: [
        {
          merch: 'Acme Corp — Payroll',
          cat: 'Income',
          who: 'john',
          amt: 3712.4,
          time: '6:00 AM',
        },
      ],
    },
  ];

  const rows = filterTransactionRows(
    groups,
    {
      memberSlug: 'john',
      category: 'Groceries',
      merchant: 'whole',
      dateFrom: '2026-05-11',
      dateTo: '2026-05-11',
      amountMin: '100',
      amountMax: '200',
    },
    '2026-05-11',
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].merch, 'Whole Foods Market');
  assert.equal(rows[0].date, '2026-05-11');
});

test('sorts matching transactions newest first when filters keep multiple rows', () => {
  const groups = [
    {
      day: 'Sun May 10',
      date: '2026-05-10',
      items: [
        { merch: 'Older', cat: 'Other', who: 'john', amt: -12, postedDate: '2026-05-10' },
      ],
    },
    {
      day: 'Today · Mon May 11',
      date: '2026-05-11',
      items: [
        { merch: 'Newer', cat: 'Other', who: 'john', amt: -14, postedDate: '2026-05-11' },
      ],
    },
  ];

  const rows = filterTransactionRows(groups, {}, '2026-05-11');

  assert.equal(rows.length, 2);
  assert.equal(rows[0].merch, 'Newer');
  assert.equal(rows[1].merch, 'Older');
});

test('builds transaction category options from both spending categories and recent activity', () => {
  const dashboardData = {
    spending: [
      { cat: 'Groceries' },
      { cat: 'Dining out' },
      { cat: 'Groceries' },
    ],
    transactions: [
      { items: [{ cat: 'Gas' }, { cat: 'Fun' }, { cat: 'Gas' }] },
      { items: [{ cat: 'Income' }, { cat: 'Kids' }] },
    ],
  };

  assert.deepEqual(buildTransactionCategoryOptions(dashboardData), [
    'Dining out',
    'Fun',
    'Gas',
    'Groceries',
    'Income',
    'Kids',
  ]);
});
