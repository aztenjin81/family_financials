import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAdminConnectionString,
  getAppConnectionString,
  quoteIdentifier,
  withClient,
} from '../scripts/db-utils.mjs';

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalPostgresUrl = process.env.POSTGRES_URL;

function withDatabaseUrl(url, callback) {
  process.env.DATABASE_URL = url;
  delete process.env.POSTGRES_URL;

  try {
    callback();
  } finally {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }

    if (originalPostgresUrl === undefined) {
      delete process.env.POSTGRES_URL;
    } else {
      process.env.POSTGRES_URL = originalPostgresUrl;
    }
  }
}

test('admin connection is rewritten to the postgres maintenance database', () => {
  withDatabaseUrl('postgresql://user:pass@127.0.0.1:5433/hermes', () => {
    const url = new URL(getAdminConnectionString());

    assert.equal(url.pathname, '/postgres');
  });
});

test('app connection is rewritten to the family_financials database', () => {
  withDatabaseUrl('postgresql://user:pass@127.0.0.1:5433/hermes', () => {
    const url = new URL(getAppConnectionString());

    assert.equal(url.pathname, '/family_financials');
  });
});

test('connection helpers do not point at hermes', () => {
  withDatabaseUrl('postgresql://user:pass@127.0.0.1:5433/hermes', () => {
    assert.notEqual(new URL(getAdminConnectionString()).pathname, '/hermes');
    assert.notEqual(new URL(getAppConnectionString()).pathname, '/hermes');
  });
});

test('connection helpers keep working after changing the working directory', () => {
  const cwd = process.cwd();

  try {
    process.chdir('/tmp');

    const url = new URL(getAppConnectionString());

    assert.equal(url.pathname, '/family_financials');
  } finally {
    process.chdir(cwd);
  }
});

test('quoteIdentifier escapes embedded double quotes', () => {
  assert.equal(quoteIdentifier('family"financials'), '"family""financials"');
});

test('withClient uses the mock database when enabled', async () => {
  const originalUseMockDb = process.env.USE_MOCK_DB;
  process.env.USE_MOCK_DB = '1';

  try {
    await withClient('postgresql://example.invalid/family_financials', async (client) => {
      const result = await client.query('select 1 from pg_database where datname = $1', ['family_financials']);

      assert.equal(result.rowCount, 1);
    });
  } finally {
    if (originalUseMockDb === undefined) {
      delete process.env.USE_MOCK_DB;
    } else {
      process.env.USE_MOCK_DB = originalUseMockDb;
    }
  }
});
