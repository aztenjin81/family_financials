import fs from 'node:fs';
import { Client } from 'pg';

export const APP_DATABASE = process.env.APP_DATABASE || 'family_financials';
export const ADMIN_DATABASE = process.env.ADMIN_DATABASE || 'postgres';

export function getAdminConnectionString() {
  const credentials = fs.readFileSync('codex_db_credentials.md', 'utf8');
  const connectionString = credentials.match(/postgres:\/\/[^\s`]+/)?.[0];

  if (!connectionString) {
    throw new Error('No Postgres connection URI found in codex_db_credentials.md');
  }

  const adminUrl = new URL(connectionString);
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
  const client = new Client({ connectionString });
  await client.connect();

  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}
