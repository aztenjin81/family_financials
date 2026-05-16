import assert from 'node:assert/strict';
import test from 'node:test';
import { getNetWorthWindow } from '../src/lib/net-worth.js';

test('net worth window trims history according to the selected range', () => {
  const history = [10, 20, 30, 40, 50, 60, 70];

  assert.deepEqual(getNetWorthWindow(history, '1M'), {
    history: [60, 70],
    total: 70,
    delta: 10,
    deltaPct: (10 / 60) * 100,
    label: 'vs. 1 month ago',
  });

  assert.deepEqual(getNetWorthWindow(history, '3M'), {
    history: [40, 50, 60, 70],
    total: 70,
    delta: 30,
    deltaPct: 75,
    label: 'vs. 3 months ago',
  });

  assert.deepEqual(getNetWorthWindow(history, 'ALL'), {
    history,
    total: 70,
    delta: 60,
    deltaPct: 600,
    label: 'vs. first sample',
  });
});

test('net worth window preserves a stable chart shape for sparse history', () => {
  assert.deepEqual(getNetWorthWindow([2500], '1Y'), {
    history: [2500, 2500],
    total: 2500,
    delta: 0,
    deltaPct: 0,
    label: 'vs. 1 year ago',
  });

  assert.deepEqual(getNetWorthWindow([], '1Y'), {
    history: [0, 0],
    total: 0,
    delta: 0,
    deltaPct: 0,
    label: 'vs. 1 year ago',
  });
});
