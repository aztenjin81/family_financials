import { getAppConnectionString, withClient } from './db-utils.mjs';
import { isMockDatabaseEnabled } from './mock-db.mjs';
import { getMockState } from './mock-db.mjs';

function normalizeDebtInput(input) {
  const name = String(input.name || '').trim();
  const paid = Number(input.paid);
  const total = Number(input.total);
  const apr = Number(input.apr);
  const pmt = Number(input.pmt);
  const end = String(input.end || '').trim();
  const revolving = Boolean(input.revolving);

  if (!name) {
    throw new Error('Debt name is required');
  }

  if (!Number.isFinite(paid) || paid < 0) {
    throw new Error('Paid amount must be zero or greater');
  }

  if (!Number.isFinite(total) || total < 0) {
    throw new Error('Total amount must be zero or greater');
  }

  if (!Number.isFinite(apr) || apr < 0) {
    throw new Error('APR must be zero or greater');
  }

  if (!Number.isFinite(pmt) || pmt < 0) {
    throw new Error('Payment amount must be zero or greater');
  }

  return {
    name,
    paid,
    total,
    apr,
    pmt,
    end: end || null,
    revolving,
  };
}

function formatDebtRow(row) {
  return {
    id: Number(row.id),
    name: row.name,
    paid: Number(row.paid_amount || 0),
    total: Number(row.total_amount || 0),
    apr: Number(row.apr || 0),
    pmt: Number(row.payment_amount || 0),
    end: row.end_label,
    revolving: Boolean(row.is_revolving),
  };
}

export async function addDebt(input) {
  const debt = normalizeDebtInput(input);

  if (isMockDatabaseEnabled()) {
    const state = getMockState();
    const row = {
      id: state.nextIds.debt++,
      household_id: state.household.id,
      name: debt.name,
      paid_amount: debt.paid,
      total_amount: debt.total,
      apr: debt.apr,
      payment_amount: debt.pmt,
      end_label: debt.end,
      is_revolving: debt.revolving,
    };

    state.debts.push(row);
    return formatDebtRow(row);
  }

  return withClient(getAppConnectionString(), async (client) => {
    const result = await client.query(
      `
        with selected_household as (
          select id
          from households
          order by id
          limit 1
        )
        insert into debts (
          household_id,
          name,
          paid_amount,
          total_amount,
          apr,
          payment_amount,
          end_label,
          is_revolving
        )
        select
          selected_household.id,
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7
        from selected_household
        returning id, name, paid_amount, total_amount, apr, payment_amount, end_label, is_revolving
      `,
      [debt.name, debt.paid, debt.total, debt.apr, debt.pmt, debt.end, debt.revolving],
    );

    return formatDebtRow(result.rows[0]);
  });
}

export async function updateDebt(debtId, input) {
  const debt = normalizeDebtInput(input);

  if (isMockDatabaseEnabled()) {
    const state = getMockState();
    const row = state.debts.find((item) => Number(item.id) === Number(debtId));

    if (!row) {
      return null;
    }

    row.name = debt.name;
    row.paid_amount = debt.paid;
    row.total_amount = debt.total;
    row.apr = debt.apr;
    row.payment_amount = debt.pmt;
    row.end_label = debt.end;
    row.is_revolving = debt.revolving;
    return formatDebtRow(row);
  }

  return withClient(getAppConnectionString(), async (client) => {
    const result = await client.query(
      `
        update debts
        set
          name = $2,
          paid_amount = $3,
          total_amount = $4,
          apr = $5,
          payment_amount = $6,
          end_label = $7,
          is_revolving = $8
        where id = $1
        returning id, name, paid_amount, total_amount, apr, payment_amount, end_label, is_revolving
      `,
      [debtId, debt.name, debt.paid, debt.total, debt.apr, debt.pmt, debt.end, debt.revolving],
    );

    if (!result.rowCount) {
      return null;
    }

    return formatDebtRow(result.rows[0]);
  });
}
