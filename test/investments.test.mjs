import assert from 'node:assert/strict';
import test from 'node:test';

import { getHoldingDeltaAmount, getInvestmentPerformance } from '../src/lib/investments.js';

test('calculates portfolio delta from holding-level daily change percentages', () => {
  const performance = getInvestmentPerformance([
    { value: 100, daily_change_percent: 10 },
    { value: 200, daily_change_percent: -5 },
  ]);

  assert.equal(performance.total, 300);
  assert.equal(performance.delta, -1.44);
  assert.equal(performance.deltaPct, -0.48);
});

test('calculates a single holding delta amount from its percentage change', () => {
  assert.equal(getHoldingDeltaAmount({ value: 100, daily_change_percent: 10 }), 9.09);
  assert.equal(getHoldingDeltaAmount({ value: 200, daily_change_percent: -5 }), -10.53);
});
