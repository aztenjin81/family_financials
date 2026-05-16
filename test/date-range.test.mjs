import assert from 'node:assert/strict';
import test from 'node:test';
import { formatBillsWindowLabel, formatDateRangeLabel } from '../src/lib/date-range.js';

test('formats a single-month date range without repeating the month', () => {
  assert.equal(formatDateRangeLabel('2026-05-11', 14), 'May 11-24');
});

test('formats a cross-month date range with both month labels', () => {
  assert.equal(formatDateRangeLabel('2026-05-28', 14), 'May 28-Jun 10');
});

test('prefixes the bills window label with the window length', () => {
  assert.equal(formatBillsWindowLabel('2026-05-11'), 'Next 14 days · May 11-24');
});
