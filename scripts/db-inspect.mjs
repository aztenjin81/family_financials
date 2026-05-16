import { getAppConnectionString, withClient } from './db-utils.mjs';

await withClient(getAppConnectionString(), async (client) => {
  const info = await client.query(`
    select
      current_database() as database,
      current_user as user,
      version() as version
  `);

  const privileges = await client.query(`
    select
      has_database_privilege(current_database(), 'CREATE') as can_create_in_database,
      has_database_privilege(current_database(), 'CONNECT') as can_connect
  `);

  const role = await client.query(`
    select
      rolcreatedb as can_create_database,
      rolcreaterole as can_create_role,
      rolsuper as is_superuser
    from pg_roles
    where rolname = current_user
  `);

  const schemas = await client.query(`
    select schema_name
    from information_schema.schemata
    where schema_name not like 'pg_%'
      and schema_name <> 'information_schema'
    order by schema_name
  `);

  const tables = await client.query(`
    select table_schema, table_name
    from information_schema.tables
    where table_schema not in ('pg_catalog', 'information_schema')
      and table_type = 'BASE TABLE'
    order by table_schema, table_name
  `);

  console.log(JSON.stringify({
    info: info.rows[0],
    privileges: privileges.rows[0],
    role: role.rows[0],
    schemas: schemas.rows,
    tables: tables.rows,
  }, null, 2));
});
