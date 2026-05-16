import assert from 'node:assert/strict';
import test from 'node:test';
import { getAdminConnectionString, getAppConnectionString, quoteIdentifier } from '../scripts/db-utils.mjs';

test('admin connection is rewritten to the postgres maintenance database', () => {
  const url = new URL(getAdminConnectionString());

  assert.equal(url.pathname, '/postgres');
});

test('app connection is rewritten to the family_financials database', () => {
  const url = new URL(getAppConnectionString());

  assert.equal(url.pathname, '/family_financials');
});

test('connection helpers do not point at hermes', () => {
  assert.notEqual(new URL(getAdminConnectionString()).pathname, '/hermes');
  assert.notEqual(new URL(getAppConnectionString()).pathname, '/hermes');
});

test('quoteIdentifier escapes embedded double quotes', () => {
  assert.equal(quoteIdentifier('family"financials'), '"family""financials"');
});
