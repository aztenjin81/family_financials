import { getAppConnectionString, withClient } from './db-utils.mjs';
import { isMockDatabaseEnabled, addMockBill, updateMockBill, setMockBillStatus } from './mock-db.mjs';

function asNumber(value) {
  return Number(value || 0);
}

function normalizeBillInput(input) {
  const memberSlug = String(input.memberSlug || '').trim();
  const monthLabel = String(input.monthLabel || '').trim();
  const name = String(input.name || '').trim();
  const subtitle = String(input.subtitle || '').trim();
  const status = String(input.status || 'upcoming').trim() || 'upcoming';
  const dayOfMonth = Number(input.dayOfMonth);
  const amount = Number(input.amount);
  const isSoon = input.isSoon == null ? false : Boolean(input.isSoon);

  if (!memberSlug) {
    throw new Error('Member is required');
  }

  if (!monthLabel) {
    throw new Error('Month label is required');
  }

  if (!name) {
    throw new Error('Bill name is required');
  }

  if (!Number.isFinite(dayOfMonth) || dayOfMonth < 1) {
    throw new Error('Day of month must be a positive number');
  }

  if (!Number.isFinite(amount)) {
    throw new Error('Amount must be a number');
  }

  if (amount < 0) {
    throw new Error('Amount must be zero or greater');
  }

  if (!['upcoming', 'paid', 'snoozed'].includes(status)) {
    throw new Error('Status must be upcoming, paid, or snoozed');
  }

  return {
    memberSlug,
    monthLabel,
    dayOfMonth: Math.trunc(dayOfMonth),
    name,
    subtitle: subtitle || null,
    amount,
    isSoon,
    status,
  };
}

function formatBillRow(row) {
  return {
    id: Number(row.id),
    monthLabel: row.month_label,
    dayOfMonth: Number(row.day_of_month),
    name: row.name,
    subtitle: row.subtitle,
    amount: asNumber(row.amount),
    memberSlug: row.member_slug,
    isSoon: Boolean(row.is_soon),
    status: row.status || 'upcoming',
  };
}

export async function addBill(input) {
  if (isMockDatabaseEnabled()) {
    return addMockBill(input);
  }

  const bill = normalizeBillInput(input);

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
        insert into bills (
          household_id,
          member_id,
          month_label,
          day_of_month,
          name,
          subtitle,
          amount,
          is_soon,
          status
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
          $8
        from selected_household, selected_member
        returning id, month_label, day_of_month, name, subtitle, amount, is_soon, status
      `,
      [
        bill.memberSlug,
        bill.monthLabel,
        bill.dayOfMonth,
        bill.name,
        bill.subtitle,
        bill.amount,
        bill.isSoon,
        bill.status,
      ],
    );

    if (!result.rowCount) {
      throw new Error('Member not found');
    }

    const row = result.rows[0];
    return formatBillRow({
      ...row,
      member_slug: bill.memberSlug,
    });
  });
}

export async function updateBill(billId, input) {
  if (isMockDatabaseEnabled()) {
    return updateMockBill(billId, input);
  }

  const bill = normalizeBillInput(input);

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
          where household_members.slug = $2
        )
        update bills
        set
          member_id = selected_member.id,
          month_label = $3,
          day_of_month = $4,
          name = $5,
          subtitle = $6,
          amount = $7,
          is_soon = $8,
          status = $9
        from selected_household, selected_member
        where bills.id = $1
          and bills.household_id = selected_household.id
        returning bills.id, month_label, day_of_month, name, subtitle, amount, is_soon, status, selected_member.id as member_id
      `,
      [
        billId,
        bill.memberSlug,
        bill.monthLabel,
        bill.dayOfMonth,
        bill.name,
        bill.subtitle,
        bill.amount,
        bill.isSoon,
        bill.status,
      ],
    );

    if (!result.rowCount) {
      return null;
    }

    const row = result.rows[0];
    return formatBillRow({
      ...row,
      member_slug: bill.memberSlug,
    });
  });
}

export async function setBillStatus(billId, status) {
  const normalizedStatus = String(status || '').trim();

  if (!['upcoming', 'paid', 'snoozed'].includes(normalizedStatus)) {
    throw new Error('Status must be upcoming, paid, or snoozed');
  }

  if (isMockDatabaseEnabled()) {
    return setMockBillStatus(billId, normalizedStatus);
  }

  return withClient(getAppConnectionString(), async (client) => {
    const result = await client.query(
      `
        update bills
        set
          status = $2,
          is_soon = case when $2 = 'upcoming' then is_soon else false end
        where id = $1
        returning id, month_label, day_of_month, name, subtitle, amount, is_soon, status
      `,
      [billId, normalizedStatus],
    );

    if (!result.rowCount) {
      return null;
    }

    const row = result.rows[0];
    return formatBillRow({
      ...row,
      member_slug: null,
    });
  });
}
