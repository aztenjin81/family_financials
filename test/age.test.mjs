import assert from 'node:assert/strict';
import test from 'node:test';
import { getAgeFromBirthDate } from '../src/lib/age.js';

test('age helper derives years from a birth date and reference date', () => {
  assert.equal(getAgeFromBirthDate('2007-09-14', new Date('2026-05-18T12:00:00Z')), 18);
  assert.equal(getAgeFromBirthDate('2015-07-23', new Date('2026-05-18T12:00:00Z')), 10);
  assert.equal(getAgeFromBirthDate('2015-05-18', new Date('2026-05-18T12:00:00Z')), 11);
  assert.equal(getAgeFromBirthDate('2015-05-19', new Date('2026-05-18T12:00:00Z')), 10);
});

test('age helper returns null for invalid input', () => {
  assert.equal(getAgeFromBirthDate('', new Date('2026-05-18T12:00:00Z')), null);
  assert.equal(getAgeFromBirthDate('not-a-date', new Date('2026-05-18T12:00:00Z')), null);
});
