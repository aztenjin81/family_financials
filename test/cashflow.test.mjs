import assert from 'node:assert/strict';
import test from 'node:test';

import { getCashflowStatus } from '../src/lib/cashflow.js';

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
