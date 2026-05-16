import assert from 'node:assert/strict';
import test from 'node:test';
import { getGreetingParts } from '../src/lib/greeting.js';

function localDateAtHour(hour) {
  return new Date(2026, 4, 15, hour, 0, 0);
}

test('returns morning greeting from 5 AM through 11 AM', () => {
  assert.deepEqual(getGreetingParts(localDateAtHour(5)), {
    lead: 'Good morning,',
    tail: '.',
  });
  assert.deepEqual(getGreetingParts(localDateAtHour(11)), {
    lead: 'Good morning,',
    tail: '.',
  });
});

test('returns afternoon greeting from noon through 4 PM', () => {
  assert.deepEqual(getGreetingParts(localDateAtHour(12)), {
    lead: 'Good afternoon,',
    tail: '.',
  });
  assert.deepEqual(getGreetingParts(localDateAtHour(16)), {
    lead: 'Good afternoon,',
    tail: '.',
  });
});

test('returns evening greeting from 5 PM through 10 PM', () => {
  assert.deepEqual(getGreetingParts(localDateAtHour(17)), {
    lead: 'Good evening,',
    tail: '.',
  });
  assert.deepEqual(getGreetingParts(localDateAtHour(22)), {
    lead: 'Good evening,',
    tail: '.',
  });
});

test('returns late-night greeting from 11 PM through 4 AM', () => {
  assert.deepEqual(getGreetingParts(localDateAtHour(23)), {
    lead: "It's too fucking late,",
    tail: '. Go to bed.',
  });
  assert.deepEqual(getGreetingParts(localDateAtHour(4)), {
    lead: "It's too fucking late,",
    tail: '. Go to bed.',
  });
});
