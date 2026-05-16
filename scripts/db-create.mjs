import { ADMIN_DATABASE, APP_DATABASE, getAdminConnectionString, quoteIdentifier, withClient } from './db-utils.mjs';

await withClient(getAdminConnectionString(), async (client) => {
  console.log(`Connected to maintenance database ${ADMIN_DATABASE}.`);

  const existing = await client.query(
    'select 1 from pg_database where datname = $1',
    [APP_DATABASE],
  );

  if (existing.rowCount) {
    console.log(`Database ${APP_DATABASE} already exists.`);
    return;
  }

  await client.query(`create database ${quoteIdentifier(APP_DATABASE)}`);
  console.log(`Created database ${APP_DATABASE}.`);
});
