import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { createMockClient, isMockDatabaseEnabled } from './mock-db.mjs';

export const APP_DATABASE = process.env.APP_DATABASE || 'family_financials';
export const ADMIN_DATABASE = process.env.ADMIN_DATABASE || 'postgres';
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readCredentialSource() {
  const envUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (envUrl) {
    return envUrl;
  }

  for (const relativePath of ['codex_db_credentials.md', '.env.local', '.env']) {
    const candidate = path.resolve(repoRoot, relativePath);

    if (!fs.existsSync(candidate)) {
      continue;
    }

    const content = fs.readFileSync(candidate, 'utf8');

    const match = content.match(/(?:DATABASE_URL|POSTGRES_URL)\s*=\s*(['"]?)(postgres(?:ql)?:\/\/[^\s`'"]+)\1/i)
      || content.match(/postgres(?:ql)?:\/\/[^\s`'"]+/i);

    if (match) {
      return match[2] || match[0];
    }
  }

  throw new Error(
    'No Postgres connection URI found. Set DATABASE_URL or POSTGRES_URL, or add one to codex_db_credentials.md, .env.local, or .env.',
  );
}

export function getAdminConnectionString() {
  const adminUrl = new URL(readCredentialSource());
  adminUrl.pathname = `/${ADMIN_DATABASE}`;
  return adminUrl.toString();
}

export function getAppConnectionString() {
  const appUrl = new URL(getAdminConnectionString());
  appUrl.pathname = `/${APP_DATABASE}`;
  return appUrl.toString();
}

export function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function withClient(connectionString, callback) {
  if (isMockDatabaseEnabled()) {
    const client = createMockClient();
    await client.connect();

    try {
      return await callback(client);
    } finally {
      await client.end();
    }
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}
