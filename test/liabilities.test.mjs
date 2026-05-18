import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPlaidLiabilityBillRow,
  buildPlaidLiabilityDebtRow,
  buildPlaidLiabilitySnapshot,
} from '../src/lib/liabilities.js';

test('builds plaid liability rows for a credit card account', () => {
  const snapshot = buildPlaidLiabilitySnapshot({
    account: {
      account_id: 'account-2',
      name: 'Plaid Credit Card',
      official_name: 'Plaid Diamond Credit Card',
      type: 'credit',
      subtype: 'credit card',
      balances: { current: 88.76, limit: 5000 },
    },
    liability: {
      aprs: [
        {
          apr_percentage: 22.99,
          apr_type: 'purchase_apr',
          balance_subject_to_apr: 88.76,
          interest_charge_amount: 1.42,
        },
      ],
      minimum_payment_amount: 35,
      next_payment_due_date: '2026-05-18',
      last_statement_balance: 123.45,
      last_statement_issue_date: '2026-05-01',
      last_payment_amount: 35,
      last_payment_date: '2026-05-03',
      is_overdue: false,
    },
    itemId: 'item-456',
    ownerSlug: 'john',
    asOfDate: '2026-05-11',
  });

  const billRow = buildPlaidLiabilityBillRow(snapshot);
  const debtRow = buildPlaidLiabilityDebtRow(snapshot);

  assert.equal(snapshot.externalItemId, 'item-456');
  assert.equal(snapshot.externalAccountId, 'account-2');
  assert.equal(snapshot.currentBalance, 88.76);
  assert.equal(snapshot.creditLimit, 5000);
  assert.equal(snapshot.apr, 22.99);
  assert.equal(snapshot.aprType, 'purchase_apr');
  assert.equal(snapshot.daysUntilDue, 7);

  assert.equal(billRow.name, 'Plaid Credit Card');
  assert.equal(billRow.amount, 35);
  assert.equal(billRow.monthLabel, 'May');
  assert.equal(billRow.dayOfMonth, 18);
  assert.ok(billRow.subtitle.includes('Minimum due'));

  assert.equal(debtRow.name, 'Plaid Credit Card');
  assert.equal(debtRow.currentBalance, 88.76);
  assert.equal(debtRow.creditLimit, 5000);
  assert.equal(debtRow.minimumPaymentAmount, 35);
  assert.equal(debtRow.revolving, true);
  assert.equal(debtRow.pmt, 35);
});
