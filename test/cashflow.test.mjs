import assert from 'node:assert/strict';
import test from 'node:test';

import { getCashflowStartingBalance, getCashflowStatus } from '../src/lib/cashflow.js';

test('classifies healthy household cashflow from a positive cushion', () => {
  assert.deepEqual(getCashflowStatus({ incoming: 14820, outgoing: 11260, net: 3560 }), {
    key: 'healthy',
    label: 'Healthy',
    tagClass: 'ok',
  });
});

test('classifies thin cashflow cushions as a warning', () => {
  assert.deepEqual(getCashflowStatus({ incoming: 5000, outgoing: 4700, net: 300 }), {
    key: 'tight',
    label: 'Thin cushion',
    tagClass: 'warn',
  });
});

test('classifies negative cashflow as an alert', () => {
  assert.deepEqual(getCashflowStatus({ incoming: 3200, outgoing: 4100, net: -900 }), {
    key: 'negative',
    label: 'Cashflow negative',
    tagClass: 'alert',
  });
});

test('derives the cashflow starting balance from cash accounts only', () => {
  assert.equal(
    getCashflowStartingBalance([
      {
        group: 'Cash',
        items: [
          { bal: 37.05 },
          { bal: 124.95 },
        ],
      },
      {
        group: 'Credit',
        items: [
          { bal: -1200.00 },
        ],
      },
      {
        group: 'Investments',
        items: [
          { bal: 5500.00 },
        ],
      },
    ]),
    162,
  );
});

test('reduces the starting balance by pending cash transactions', () => {
  assert.equal(
    getCashflowStartingBalance(
      [
        {
          group: 'Cash',
          items: [
            {
              bal: 37.05,
              externalAccountId: 'cash-account-1',
            },
          ],
        },
      ],
      [
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
    ),
    3.7,
  );
});
