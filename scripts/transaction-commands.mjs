import { getAppConnectionString, withClient } from './db-utils.mjs';

function asNumber(value) {
  return Number(value || 0);
}

export function normalizeTransactionInput(input) {
  const merchant = String(input.merchant || '').trim();
  const category = String(input.category || '').trim();
  const memberSlug = String(input.memberSlug || '').trim();
  const postedLabel = String(input.postedLabel || 'Today').trim();
  const timeLabel = String(input.timeLabel || '').trim();
  const emoji = String(input.emoji || '•').trim();
  const isIncome = Boolean(input.isIncome);
  const rawAmount = Number(input.amount);

  if (!merchant) {
    throw new Error('Merchant is required');
  }

  if (!category) {
    throw new Error('Category is required');
  }

  if (!memberSlug) {
    throw new Error('Member is required');
  }

  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    throw new Error('Amount must be greater than zero');
  }

  return {
    merchant,
    category,
    memberSlug,
    postedLabel,
    timeLabel,
    emoji,
    isIncome,
    amount: isIncome ? rawAmount : -rawAmount,
  };
}

export async function addTransaction(input) {
  const transaction = normalizeTransactionInput(input);

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
        selected_posted_label as (
          select
            case
              when $2 = 'Today' then coalesce((
                select posted_label
                from transactions
                where household_id = (select id from selected_household)
                  and posted_label like 'Today · %'
                order by sort_order, id
                limit 1
              ), $2)
              else $2
            end as posted_label
        ),
        next_sort as (
          select coalesce(max(sort_order), -1) + 1 as sort_order
          from transactions
          where household_id = (select id from selected_household)
        )
        insert into transactions (
          household_id,
          member_id,
          posted_label,
          merchant,
          category,
          amount,
          time_label,
          emoji,
          is_income,
          sort_order
        )
        select
          selected_household.id,
          selected_member.id,
          selected_posted_label.posted_label,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          next_sort.sort_order
        from selected_household, selected_member, selected_posted_label, next_sort
        returning id, posted_label, merchant, category, amount, time_label, emoji, is_income
      `,
      [
        transaction.memberSlug,
        transaction.postedLabel,
        transaction.merchant,
        transaction.category,
        transaction.amount,
        transaction.timeLabel,
        transaction.emoji,
        transaction.isIncome,
      ],
    );

    if (!result.rowCount) {
      throw new Error('Member not found');
    }

    const row = result.rows[0];
    return {
      id: Number(row.id),
      postedLabel: row.posted_label,
      merchant: row.merchant,
      category: row.category,
      amount: asNumber(row.amount),
      timeLabel: row.time_label,
      emoji: row.emoji,
      isIncome: row.is_income,
    };
  });
}
