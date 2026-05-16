import { getAppConnectionString, withClient } from './db-utils.mjs';

const statements = [
  `
    create table if not exists households (
      id bigserial primary key,
      name text not null,
      as_of date,
      insight text,
      created_at timestamptz not null default now()
    )
  `,
  `
    create table if not exists household_members (
      id bigserial primary key,
      household_id bigint not null references households(id) on delete cascade,
      slug text not null,
      display_name text not null,
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
      sort_order integer not null default 0
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
      posted_label text not null,
      merchant text not null,
      category text,
      amount numeric(14, 2) not null,
      time_label text,
      emoji text,
      is_income boolean not null default false,
      sort_order integer not null default 0
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
      is_soon boolean not null default false
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
      is_revolving boolean not null default false
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

  console.log('Applied database schema.');
});
