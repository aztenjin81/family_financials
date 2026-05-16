import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const source = fs.readFileSync('scripts/dev-all.mjs', 'utf8');

test('package exposes a combined local dev command', () => {
  assert.equal(packageJson.scripts['dev:all'], 'node scripts/dev-all.mjs');
});

test('combined dev command starts the API and Vite dev servers', () => {
  assert.match(source, /args: \['run', 'api'\]/);
  assert.match(source, /args: \['run', 'dev'\]/);
});

test('combined dev command shuts down peer processes on exit or termination', () => {
  assert.match(source, /child\.on\('exit'/);
  assert.match(source, /process\.on\('SIGINT', shutdown\)/);
  assert.match(source, /process\.on\('SIGTERM', shutdown\)/);
  assert.match(source, /child\.kill\(\)/);
});
