import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMerchantAutofillMap, getMerchantAutofill } from '../src/lib/merchant-history.js';

test('buildMerchantAutofillMap uses the most recent matching merchant history', () => {
  const history = buildMerchantAutofillMap([
    {
      day: 'Yesterday',
      items: [
        { id: 2, merch: 'Whole Foods Market', cat: 'Groceries', who: 'john', emoji: '🛒' },
      ],
    },
    {
      day: 'Today',
      items: [
        { id: 7, merch: 'Whole Foods Market', cat: 'Household', who: 'stephanie', emoji: '🧺' },
      ],
    },
  ]);

  assert.deepEqual(getMerchantAutofill(history, 'whole foods market'), {
    category: 'Household',
    memberSlug: 'stephanie',
    emoji: '🧺',
    id: 7,
  });
});

test('buildMerchantAutofillMap ignores blank merchant names', () => {
  const history = buildMerchantAutofillMap([
    { day: 'Today', items: [{ id: 1, merch: '   ', cat: 'Groceries', who: 'john', emoji: '🛒' }] },
  ]);

  assert.equal(getMerchantAutofill(history, '   '), null);
  assert.equal(history.size, 0);
});
