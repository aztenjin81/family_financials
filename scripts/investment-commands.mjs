import { getAppConnectionString, withClient } from './db-utils.mjs';
import { isMockDatabaseEnabled, updateMockHolding } from './mock-db.mjs';

function normalizeHoldingInput(input) {
  const ticker = String(input.ticker || '').trim();
  const name = String(input.name || '').trim();
  const value = Number(input.value);
  const dailyChangePercent = Number(input.dailyChangePercent);

  if (!ticker) {
    throw new Error('Ticker is required');
  }

  if (!name) {
    throw new Error('Holding name is required');
  }

  if (!Number.isFinite(value)) {
    throw new Error('Value must be a number');
  }

  if (!Number.isFinite(dailyChangePercent)) {
    throw new Error('Daily change percent must be a number');
  }

  return {
    ticker,
    name,
    value,
    dailyChangePercent,
  };
}

function formatHoldingRow(row) {
  return {
    id: Number(row.id),
    ticker: row.ticker,
    name: row.name,
    value: Number(row.value || 0),
    dailyChangePercent: Number(row.daily_change_percent || 0),
  };
}

export async function updateInvestmentHolding(holdingId, input) {
  if (isMockDatabaseEnabled()) {
    return updateMockHolding(holdingId, input);
  }

  const holding = normalizeHoldingInput(input);

  return withClient(getAppConnectionString(), async (client) => {
    const result = await client.query(
      `
        with selected_household as (
          select id
          from households
          order by id
          limit 1
        )
        update investment_holdings
        set
          ticker = $2,
          name = $3,
          value = $4,
          daily_change_percent = $5
        from selected_household
        where investment_holdings.id = $1
          and investment_holdings.household_id = selected_household.id
        returning investment_holdings.id, ticker, name, value, daily_change_percent
      `,
      [holdingId, holding.ticker, holding.name, holding.value, holding.dailyChangePercent],
    );

    if (!result.rowCount) {
      return null;
    }

    return formatHoldingRow(result.rows[0]);
  });
}
