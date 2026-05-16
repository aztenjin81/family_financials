import { normalizeAccountInput, normalizeImportedAccountInput } from './account-input.mjs';
import { getAppConnectionString, withClient } from './db-utils.mjs';

function asNumber(value) {
  return Number(value || 0);
}

export async function addAccount(input) {
  const account = normalizeAccountInput(input);

  return withClient(getAppConnectionString(), async (client) => {
    const result = await client.query(
      `
        with selected_household as (
          select id
          from households
          order by id
          limit 1
        ),
        selected_member as (
          select household_members.id
          from household_members
          join selected_household on selected_household.id = household_members.household_id
          where household_members.slug = $1
        ),
        next_sort as (
          select coalesce(max(sort_order), -1) + 1 as sort_order
          from accounts
          where household_id = (select id from selected_household)
        )
        insert into accounts (
          household_id,
          owner_member_id,
          account_group,
          name,
          subtitle,
          icon,
          balance,
          sort_order
        )
        select
          selected_household.id,
          selected_member.id,
          $2,
          $3,
          $4,
          $5,
          $6,
          next_sort.sort_order
        from selected_household, selected_member, next_sort
        returning id, account_group, name, subtitle, icon, balance, owner_member_id
      `,
      [
        account.ownerSlug,
        account.accountGroup,
        account.name,
        account.subtitle,
        account.icon,
        account.balance,
      ],
    );

    if (!result.rowCount) {
      throw new Error('Owner not found');
    }

    const row = result.rows[0];
    return {
      id: Number(row.id),
      accountGroup: row.account_group,
      name: row.name,
      subtitle: row.subtitle,
      icon: row.icon,
      balance: asNumber(row.balance),
      ownerSlug: account.ownerSlug,
    };
  });
}

export async function updateAccount(accountId, input) {
  const account = normalizeAccountInput(input);

  return withClient(getAppConnectionString(), async (client) => {
    const result = await client.query(
      `
        with selected_account as (
          select household_id
          from accounts
          where id = $1
        ),
        selected_member as (
          select household_members.id
          from household_members
          join selected_account on selected_account.household_id = household_members.household_id
          where household_members.slug = $2
        )
        update accounts
        set
          owner_member_id = selected_member.id,
          account_group = $3,
          name = $4,
          subtitle = $5,
          icon = $6,
          balance = $7
        from selected_account, selected_member
        where accounts.id = $1
          and accounts.household_id = selected_account.household_id
        returning accounts.id, account_group, name, subtitle, icon, balance, external_provider, external_item_id, external_account_id, imported_at, sync_status
      `,
      [
        accountId,
        account.ownerSlug,
        account.accountGroup,
        account.name,
        account.subtitle,
        account.icon,
        account.balance,
      ],
    );

    if (!result.rowCount) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: Number(row.id),
      accountGroup: row.account_group,
      name: row.name,
      subtitle: row.subtitle,
      icon: row.icon,
      balance: asNumber(row.balance),
      ownerSlug: account.ownerSlug,
      externalProvider: row.external_provider,
      externalItemId: row.external_item_id,
      externalAccountId: row.external_account_id,
      importedAt: row.imported_at,
      syncStatus: row.sync_status,
    };
  });
}

export async function syncImportedAccount(input) {
  const account = normalizeImportedAccountInput(input);

  return withClient(getAppConnectionString(), async (client) => {
    const result = await client.query(
      `
        with selected_household as (
          select id
          from households
          order by id
          limit 1
        ),
        selected_member as (
          select household_members.id
          from household_members
          join selected_household on selected_household.id = household_members.household_id
          where household_members.slug = $1
        )
        insert into accounts (
          household_id,
          owner_member_id,
          account_group,
          name,
          subtitle,
          icon,
          balance,
          external_provider,
          external_item_id,
          external_account_id,
          imported_at,
          sync_status
        )
        select
          selected_household.id,
          selected_member.id,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          now(),
          'synced'
        from selected_household, selected_member
        on conflict (household_id, external_provider, external_account_id)
        do update set
          owner_member_id = excluded.owner_member_id,
          account_group = excluded.account_group,
          name = excluded.name,
          subtitle = excluded.subtitle,
          icon = excluded.icon,
          balance = excluded.balance,
          external_item_id = excluded.external_item_id,
          imported_at = excluded.imported_at,
          sync_status = excluded.sync_status
        returning
          id,
          account_group,
          name,
          subtitle,
          icon,
          balance,
          owner_member_id,
          external_provider,
          external_item_id,
          external_account_id,
          imported_at,
          sync_status,
          (xmax = 0) as inserted
      `,
      [
        account.ownerSlug,
        account.accountGroup,
        account.name,
        account.subtitle,
        account.icon,
        account.balance,
        account.provider,
        account.externalItemId,
        account.externalAccountId,
      ],
    );

    if (!result.rowCount) {
      throw new Error('Owner not found');
    }

    const row = result.rows[0];
    return {
      id: Number(row.id),
      accountGroup: row.account_group,
      name: row.name,
      subtitle: row.subtitle,
      icon: row.icon,
      balance: asNumber(row.balance),
      ownerSlug: account.ownerSlug,
      externalProvider: row.external_provider,
      externalItemId: row.external_item_id,
      externalAccountId: row.external_account_id,
      importedAt: row.imported_at,
      syncStatus: row.sync_status,
      inserted: row.inserted,
    };
  });
}
