import assert from 'node:assert/strict';
import test from 'node:test';

import { getDebtProjection } from '../src/lib/debts.js';

test('projects a debt payoff from balance, apr, and monthly payment', () => {
  const projection = getDebtProjection({
    paid: 9580,
    total: 22000,
    apr: 6.2,
    pmt: 412,
  }, '2026-05-11');

  assert.equal(projection.remaining, 12420);
  assert.equal(projection.status, 'projected');
  assert.equal(projection.estimatedMonths > 0, true);
  assert.match(projection.payoffLabel, /^[A-Z][a-z]{2} \d{4}$/);
});

test('flags debts with payments that do not retire the balance', () => {
  const projection = getDebtProjection({
    paid: 0,
    total: 842,
    apr: 22.99,
    pmt: 10,
  }, '2026-05-11');

  assert.equal(projection.status, 'warning');
  assert.equal(projection.estimatedMonths, null);
  assert.equal(projection.payoffLabel, 'Payment too low');
});

test('projects a debt payoff from current balance when imported from Plaid liabilities', () => {
  const projection = getDebtProjection({
    total: 5000,
    currentBalance: 88.76,
    apr: 22.99,
    pmt: 35,
  }, '2026-05-11');

  assert.equal(projection.remaining, 88.76);
  assert.equal(projection.status, 'projected');
  assert.equal(projection.estimatedMonths > 0, true);
});
