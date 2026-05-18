import assert from 'node:assert/strict';
import test from 'node:test';
import { getSuggestedChoreTemplates } from '../src/lib/chore-templates.js';

test('suggested chore templates vary by age band', () => {
  assert.deepEqual(
    getSuggestedChoreTemplates(5).map((template) => template.label),
    [
      'Put shoes in the basket',
      'Put toys away after playtime',
      'Set napkins on the table',
    ],
  );

  assert.deepEqual(
    getSuggestedChoreTemplates(10).map((template) => template.label),
    [
      'Run dishwasher before bed',
      'Put away laundry',
      'Wipe kitchen counters',
    ],
  );

  assert.deepEqual(
    getSuggestedChoreTemplates(18).map((template) => template.label),
    [
      'Review scholarship checklist',
      'Help Jason with reading log',
      'Plan weekly family cleanup',
    ],
  );
});
