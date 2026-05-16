import assert from 'node:assert/strict';
import test from 'node:test';
import { formatTransactionDayLabel, parseTransactionDateLabel } from '../src/lib/transaction-date.js';

test('transaction date helpers format today labels and parse legacy labels', () => {
  assert.equal(formatTransactionDayLabel('2026-05-11', '2026-05-11'), 'Today · Mon May 11');
  assert.equal(formatTransactionDayLabel('2026-05-10', '2026-05-11'), 'Sun May 10');
  assert.equal(parseTransactionDateLabel('Today · Mon May 11', '2026-05-11'), '2026-05-11');
  assert.equal(parseTransactionDateLabel('Sat May 9 · payday', '2026-05-11'), '2026-05-09');
});
