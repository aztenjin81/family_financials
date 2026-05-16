import assert from 'node:assert/strict';
import test from 'node:test';
import { getApiRequestUrls } from '../src/lib/api.js';

test('API client retries the direct API port during local Vite development', () => {
  assert.deepEqual(getApiRequestUrls('/api/transactions', 'http://127.0.0.1:5173'), [
    '/api/transactions',
    'http://127.0.0.1:8787/api/transactions',
  ]);
});

test('API client does not add local fallback for non-local origins', () => {
  assert.deepEqual(getApiRequestUrls('/api/transactions', 'https://finance.example.com'), [
    '/api/transactions',
  ]);
});

test('API client does not duplicate direct API origin', () => {
  assert.deepEqual(getApiRequestUrls('/api/transactions', 'http://127.0.0.1:8787'), [
    '/api/transactions',
  ]);
});
