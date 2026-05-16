import { getAppConnectionString, withClient } from './db-utils.mjs';
import {
  addMockTransaction,
  deleteMockTransaction,
  isMockDatabaseEnabled,
  updateMockTransaction,
} from './mock-db.mjs';
import { formatTransactionDayLabel, normalizeDateInput, parseTransactionDateLabel } from '../src/lib/transaction-date.js';

function asNumber(value) {
  return Number(value || 0);
}

function formatRowDate(value) {
  if (!value) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function fallbackDate(asOfDate) {
  return normalizeDateInput(asOfDate) || new Date().toISOString().slice(0, 10);
}

export function normalizeTransactionInput(input, asOfDate) {
  const defaultDate = fallbackDate(asOfDate);
  const merchant = String(input.merchant || '').trim();
  const category = String(input.category || '').trim();
  const memberSlug = String(input.memberSlug || '').trim();
  const postedDate = normalizeDateInput(input.postedDate || defaultDate) || defaultDate;
  const postedLabel = formatTransactionDayLabel(postedDate, defaultDate);
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
    postedDate,
    postedLabel,
    timeLabel,
    emoji,
    isIncome,
    amount: isIncome ? rawAmount : -rawAmount,
  };
}

function normalizeTransactionUpdateInput(input, currentTransaction, asOfDate) {
  const defaultDate = fallbackDate(asOfDate);
  const postedDate = normalizeDateInput(
    input.postedDate
      || currentTransaction.posted_date
      || parseTransactionDateLabel(currentTransaction.posted_label, defaultDate),
  ) || defaultDate;

  const merged = {
    merchant: String(input.merchant || currentTransaction.merchant || '').trim(),
    category: String(input.category || currentTransaction.category || '').trim(),
    memberSlug: String(input.memberSlug || currentTransaction.member_slug || '').trim(),
    postedDate,
    postedLabel: formatTransactionDayLabel(postedDate, defaultDate),
    timeLabel: String(input.timeLabel || currentTransaction.time_label || '').trim(),
    emoji: String(input.emoji || currentTransaction.emoji || '•').trim(),
    isIncome: input.isIncome == null ? Boolean(currentTransaction.is_income) : Boolean(input.isIncome),
    amount: input.amount == null || input.amount === ''
      ? Math.abs(Number(currentTransaction.amount || 0))
      : Number(input.amount),
  };

  if (!merged.merchant) {
    throw new Error('Merchant is required');
  }

  if (!merged.category) {
    throw new Error('Category is required');
  }

  if (!Number.isFinite(merged.amount) || merged.amount <= 0) {
    throw new Error('Amount must be greater than zero');
  }

  return {
    ...merged,
    amount: merged.isIncome ? merged.amount : -merged.amount,
  };
}

export async function addTransaction(input) {
  if (isMockDatabaseEnabled()) {
    return addMockTransaction(input);
  }

  return withClient(getAppConnectionString(), async (client) => {
    const householdResult = await client.query(
      `
        select id, as_of
        from households
        order by id
        limit 1
      `,
    );

    if (!householdResult.rowCount) {
      throw new Error('No household found');
    }

    const household = householdResult.rows[0];
    const transaction = normalizeTransactionInput(input, household.as_of);

    const result = await client.query(
      `
        with selected_member as (
          select household_members.id
          from household_members
          where household_members.household_id = $1
            and household_members.slug = $2
          limit 1
        ),
        next_sort as (
          select coalesce(max(sort_order), -1) + 1 as sort_order
          from transactions
          where household_id = $1
        )
        insert into transactions (
          household_id,
          member_id,
          posted_date,
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
          $1,
          selected_member.id,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          next_sort.sort_order
        from selected_member, next_sort
        returning id, posted_date, posted_label, merchant, category, amount, time_label, emoji, is_income
      `,
      [
        household.id,
        transaction.memberSlug,
        transaction.postedDate,
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
      postedDate: normalizeDateInput(formatRowDate(row.posted_date)),
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

export async function deleteTransaction(transactionId) {
  if (isMockDatabaseEnabled()) {
    return deleteMockTransaction(transactionId);
  }

  return withClient(getAppConnectionString(), async (client) => {
    const result = await client.query(
      `
        delete from transactions
        where id = $1
        returning id
      `,
      [transactionId],
    );

    if (!result.rowCount) {
      return null;
    }

    return {
      id: Number(result.rows[0].id),
    };
  });
}

export async function updateTransaction(transactionId, input) {
  if (isMockDatabaseEnabled()) {
    return updateMockTransaction(transactionId, input);
  }

  return withClient(getAppConnectionString(), async (client) => {
    const currentResult = await client.query(
      `
        select
          transactions.id,
          transactions.household_id,
          transactions.member_id,
          household_members.slug as member_slug,
          households.as_of,
          transactions.posted_date,
          transactions.posted_label,
          transactions.merchant,
          transactions.category,
          transactions.amount,
          transactions.time_label,
          transactions.emoji,
          transactions.is_income
        from transactions
        join households on households.id = transactions.household_id
        left join household_members on household_members.id = transactions.member_id
        where transactions.id = $1
      `,
      [transactionId],
    );

    if (!currentResult.rowCount) {
      return null;
    }

    const currentTransaction = currentResult.rows[0];
    const transaction = normalizeTransactionUpdateInput(input, currentTransaction, currentTransaction.as_of);

    const result = await client.query(
      `
        with selected_transaction as (
          select household_id, member_id
          from transactions
          where id = $1
        )
        update transactions
        set
          member_id = coalesce((
            select household_members.id
            from household_members
            join selected_transaction on selected_transaction.household_id = household_members.household_id
            where household_members.slug = $2
            limit 1
          ), transactions.member_id),
          posted_date = $3,
          posted_label = $4,
          merchant = $5,
          category = $6,
          amount = $7,
          time_label = $8,
          emoji = $9,
          is_income = $10
        from selected_transaction
        where transactions.id = $1
          and transactions.household_id = selected_transaction.household_id
        returning
          transactions.id,
          transactions.posted_date,
          transactions.posted_label,
          transactions.merchant,
          transactions.category,
          transactions.amount,
          transactions.time_label,
          transactions.emoji,
          transactions.is_income
      `,
      [
        transactionId,
        transaction.memberSlug || currentTransaction.member_slug || '',
        transaction.postedDate,
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
      return null;
    }

    const row = result.rows[0];
    return {
      id: Number(row.id),
      postedDate: normalizeDateInput(formatRowDate(row.posted_date)),
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
