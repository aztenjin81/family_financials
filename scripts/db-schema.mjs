import { getAppConnectionString, withClient } from './db-utils.mjs';

const statements = [
  `
    create table if not exists households (
      id bigserial primary key,
      name text not null,
      as_of date,
      insight text,
      allowance_weekly_amount numeric(14, 2) not null default 5,
      created_at timestamptz not null default now()
    )
  `,
  `
    create table if not exists household_members (
      id bigserial primary key,
      household_id bigint not null references households(id) on delete cascade,
      slug text not null,
      display_name text not null,
      birth_date date,
      age integer,
      role text not null default 'member',
      unique (household_id, slug)
    )
  `,
  `
    create table if not exists accounts (
      id bigserial primary key,
      household_id bigint not null references households(id) on delete cascade,
      owner_member_id bigint references household_members(id) on delete set null,
      account_group text not null,
      name text not null,
      subtitle text,
      icon text,
      balance numeric(14, 2) not null default 0,
      sort_order integer not null default 0,
      external_provider text,
      external_item_id text,
      external_account_id text,
      imported_at timestamptz,
      sync_status text
    )
  `,
  `
    create table if not exists plaid_items (
      id bigserial primary key,
      household_id bigint not null references households(id) on delete cascade,
      provider text not null default 'plaid',
      item_id text not null,
      access_token text not null,
      institution_name text,
      link_session_id text,
      transaction_cursor text,
      sync_status text not null default 'linked',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (household_id, provider, item_id)
    )
  `,
  `
    create table if not exists spending_categories (
      id bigserial primary key,
      household_id bigint not null references households(id) on delete cascade,
      name text not null,
      color text,
      spent numeric(14, 2) not null default 0,
      budget numeric(14, 2) not null default 0,
      unique (household_id, name)
    )
  `,
  `
    create table if not exists goals (
      id bigserial primary key,
      household_id bigint not null references households(id) on delete cascade,
      owner_member_id bigint references household_members(id) on delete set null,
      name text not null,
      current_amount numeric(14, 2) not null default 0,
      target_amount numeric(14, 2) not null default 0,
      color text,
      target_label text
    )
  `,
  `
    create table if not exists transactions (
      id bigserial primary key,
      household_id bigint not null references households(id) on delete cascade,
      member_id bigint references household_members(id) on delete set null,
      posted_date date,
      posted_label text not null,
      merchant text not null,
      category text,
      amount numeric(14, 2) not null,
      time_label text,
      emoji text,
      is_income boolean not null default false,
      sort_order integer not null default 0,
      external_provider text,
      external_item_id text,
      external_account_id text,
      external_transaction_id text,
      imported_at timestamptz,
      sync_status text
    )
  `,
  `
    create table if not exists bills (
      id bigserial primary key,
      household_id bigint not null references households(id) on delete cascade,
      member_id bigint references household_members(id) on delete set null,
      month_label text not null,
      day_of_month integer not null,
      name text not null,
      subtitle text,
      amount numeric(14, 2) not null,
      is_soon boolean not null default false,
      status text not null default 'upcoming',
      external_provider text,
      external_item_id text,
      external_account_id text,
      imported_at timestamptz,
      sync_status text
    )
  `,
  `
    create table if not exists investment_holdings (
      id bigserial primary key,
      household_id bigint not null references households(id) on delete cascade,
      ticker text not null,
      name text not null,
      value numeric(14, 2) not null,
      daily_change_percent numeric(8, 2) not null default 0
    )
  `,
  `
    create table if not exists debts (
      id bigserial primary key,
      household_id bigint not null references households(id) on delete cascade,
      name text not null,
      paid_amount numeric(14, 2) not null default 0,
      total_amount numeric(14, 2) not null default 0,
      apr numeric(8, 2),
      payment_amount numeric(14, 2),
      end_label text,
      is_revolving boolean not null default false,
      current_balance numeric(14, 2),
      credit_limit numeric(14, 2),
      minimum_payment_amount numeric(14, 2),
      next_payment_due_date date,
      last_statement_balance numeric(14, 2),
      last_statement_issue_date date,
      last_payment_amount numeric(14, 2),
      last_payment_date date,
      apr_type text,
      interest_charge_amount numeric(14, 2),
      liability_type text,
      external_provider text,
      external_item_id text,
      external_account_id text,
      imported_at timestamptz,
      sync_status text
    )
  `,
  `
    create table if not exists kid_jars (
      id bigserial primary key,
      member_id bigint not null references household_members(id) on delete cascade,
      spend numeric(14, 2) not null default 0,
      save numeric(14, 2) not null default 0,
      give numeric(14, 2) not null default 0
    )
  `,
  `
    create table if not exists allowance_payments (
      id bigserial primary key,
      household_id bigint not null references households(id) on delete cascade,
      member_id bigint not null references household_members(id) on delete cascade,
      paid_at timestamptz not null default now(),
      weekly_amount numeric(14, 2) not null,
      spend_amount numeric(14, 2) not null,
      save_amount numeric(14, 2) not null,
      give_amount numeric(14, 2) not null
    )
  `,
  `
    create table if not exists chores (
      id bigserial primary key,
      member_id bigint not null references household_members(id) on delete cascade,
      label text not null,
      reward numeric(14, 2) not null default 0,
      is_done boolean not null default false
    )
  `,
  `
    create table if not exists forecast_weeks (
      id bigserial primary key,
      household_id bigint not null references households(id) on delete cascade,
      week_label text not null,
      incoming numeric(14, 2) not null default 0,
      outgoing numeric(14, 2) not null default 0,
      sort_order integer not null default 0
    )
  `,
  `
    create table if not exists net_worth_history (
      id bigserial primary key,
      household_id bigint not null references households(id) on delete cascade,
      value numeric(14, 2) not null,
      sort_order integer not null default 0
    )
  `,
];

await withClient(getAppConnectionString(), async (client) => {
  for (const statement of statements) {
    await client.query(statement);
  }

  await client.query('alter table if exists transactions add column if not exists posted_date date');
  await client.query('alter table if exists households add column if not exists allowance_weekly_amount numeric(14, 2) not null default 5');
  await client.query('alter table if exists household_members add column if not exists birth_date date');
  await client.query('alter table if exists accounts add column if not exists external_provider text');
  await client.query('alter table if exists accounts add column if not exists external_item_id text');
  await client.query('alter table if exists accounts add column if not exists external_account_id text');
  await client.query('alter table if exists accounts add column if not exists imported_at timestamptz');
  await client.query('alter table if exists accounts add column if not exists sync_status text');
  await client.query('alter table if exists plaid_items add column if not exists provider text');
  await client.query('alter table if exists plaid_items add column if not exists item_id text');
  await client.query('alter table if exists plaid_items add column if not exists access_token text');
  await client.query('alter table if exists plaid_items add column if not exists institution_name text');
  await client.query('alter table if exists plaid_items add column if not exists link_session_id text');
  await client.query('alter table if exists plaid_items add column if not exists transaction_cursor text');
  await client.query('alter table if exists plaid_items add column if not exists sync_status text');
  await client.query('alter table if exists plaid_items add column if not exists created_at timestamptz');
  await client.query('alter table if exists plaid_items add column if not exists updated_at timestamptz');
  await client.query('alter table if exists bills add column if not exists status text');
  await client.query('alter table if exists bills add column if not exists external_provider text');
  await client.query('alter table if exists bills add column if not exists external_item_id text');
  await client.query('alter table if exists bills add column if not exists external_account_id text');
  await client.query('alter table if exists bills add column if not exists imported_at timestamptz');
  await client.query('alter table if exists bills add column if not exists sync_status text');
  await client.query('alter table if exists debts add column if not exists current_balance numeric(14, 2)');
  await client.query('alter table if exists debts add column if not exists credit_limit numeric(14, 2)');
  await client.query('alter table if exists debts add column if not exists minimum_payment_amount numeric(14, 2)');
  await client.query('alter table if exists debts add column if not exists next_payment_due_date date');
  await client.query('alter table if exists debts add column if not exists last_statement_balance numeric(14, 2)');
  await client.query('alter table if exists debts add column if not exists last_statement_issue_date date');
  await client.query('alter table if exists debts add column if not exists last_payment_amount numeric(14, 2)');
  await client.query('alter table if exists debts add column if not exists last_payment_date date');
  await client.query('alter table if exists debts add column if not exists apr_type text');
  await client.query('alter table if exists debts add column if not exists interest_charge_amount numeric(14, 2)');
  await client.query('alter table if exists debts add column if not exists liability_type text');
  await client.query('alter table if exists debts add column if not exists external_provider text');
  await client.query('alter table if exists debts add column if not exists external_item_id text');
  await client.query('alter table if exists debts add column if not exists external_account_id text');
  await client.query('alter table if exists debts add column if not exists imported_at timestamptz');
  await client.query('alter table if exists debts add column if not exists sync_status text');
  await client.query('alter table if exists transactions add column if not exists external_provider text');
  await client.query('alter table if exists transactions add column if not exists external_item_id text');
  await client.query('alter table if exists transactions add column if not exists external_account_id text');
  await client.query('alter table if exists transactions add column if not exists external_transaction_id text');
  await client.query('alter table if exists transactions add column if not exists imported_at timestamptz');
  await client.query('alter table if exists transactions add column if not exists sync_status text');
  await client.query(
    'create unique index if not exists accounts_external_source_key on accounts (household_id, external_provider, external_account_id)',
  );
  await client.query(
    'create unique index if not exists bills_external_source_key on bills (household_id, external_provider, external_account_id)',
  );
  await client.query(
    'create unique index if not exists debts_external_source_key on debts (household_id, external_provider, external_account_id)',
  );
  await client.query(
    'create unique index if not exists plaid_items_source_key on plaid_items (household_id, provider, item_id)',
  );
  await client.query(
    'create unique index if not exists transactions_external_source_key on transactions (household_id, external_provider, external_transaction_id)',
  );

  console.log('Applied database schema.');
});
