import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeImportedAccountInput } from '../scripts/account-input.mjs';

test('normalizeImportedAccountInput trims sync metadata and preserves account fields', () => {
  const account = normalizeImportedAccountInput({
    accountGroup: '  Cash  ',
    name: '  Imported Checking  ',
    subtitle: '  Plaid sync  ',
    icon: '  Bank  ',
    ownerSlug: '  john  ',
    balance: ' 123.45 ',
    provider: '  plaid  ',
    externalItemId: '  item-123  ',
    externalAccountId: '  account-456  ',
  });

  assert.deepEqual(account, {
    accountGroup: 'Cash',
    name: 'Imported Checking',
    subtitle: 'Plaid sync',
    icon: 'Bank',
    ownerSlug: 'john',
    balance: 123.45,
    provider: 'plaid',
    externalItemId: 'item-123',
    externalAccountId: 'account-456',
  });
});

test('normalizeImportedAccountInput requires a provider', () => {
  assert.throws(
    () => normalizeImportedAccountInput({
      accountGroup: 'Cash',
      name: 'Imported Checking',
      ownerSlug: 'john',
      balance: 123.45,
      externalAccountId: 'account-456',
    }),
    /Provider is required/,
  );
});

test('normalizeImportedAccountInput requires an external account id', () => {
  assert.throws(
    () => normalizeImportedAccountInput({
      accountGroup: 'Cash',
      name: 'Imported Checking',
      ownerSlug: 'john',
      balance: 123.45,
      provider: 'plaid',
    }),
    /External account id is required/,
  );
});
