#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const batches = [
  [
    'test/account-input.test.mjs',
    'test/accounts.test.mjs',
    'test/api-client.test.mjs',
    'test/api-handler.test.mjs',
    'test/app-shell-source.test.mjs',
  ],
  [
    'test/cashflow.test.mjs',
    'test/dashboard-query.test.mjs',
    'test/date-range.test.mjs',
    'test/db-utils.test.mjs',
    'test/dev-all.test.mjs',
  ],
  [
    'test/greeting.test.mjs',
    'test/merchant-history.test.mjs',
    'test/net-worth.test.mjs',
    'test/repo-policy.test.mjs',
    'test/transaction-date.test.mjs',
  ],
];

function buildTestEnv() {
  const allowedKeys = new Set([
    'PATH',
    'HOME',
    'USER',
    'LOGNAME',
    'PWD',
    'TMPDIR',
    'TMP',
    'TEMP',
    'LANG',
    'LC_ALL',
    'LC_CTYPE',
    'DATABASE_URL',
    'POSTGRES_URL',
    'APP_DATABASE',
    'ADMIN_DATABASE',
    'USE_MOCK_DB',
  ]);

  const env = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (allowedKeys.has(key) || key.startsWith('PG')) {
      env[key] = value;
    }
  }

  return env;
}

for (const batch of batches) {
  const result = spawnSync(process.execPath, [
    '--test',
    '--test-concurrency=1',
    '--test-reporter=spec',
    ...batch,
  ], {
    stdio: 'inherit',
    env: buildTestEnv(),
    cwd: process.cwd(),
  });

  if (result.status !== 0) {
    process.exitCode = result.status || 1;
    break;
  }
}
