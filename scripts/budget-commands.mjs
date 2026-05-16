import { getAppConnectionString, withClient } from './db-utils.mjs';
import { isMockDatabaseEnabled, updateMockSpendingBudget } from './mock-db.mjs';

function asNumber(value) {
  return Number(value || 0);
}

function normalizeBudgetInput(input) {
  const rawBudget = Number(input.budget);

  if (!Number.isFinite(rawBudget)) {
    throw new Error('Budget must be a number');
  }

  if (rawBudget < 0) {
    throw new Error('Budget must be zero or greater');
  }

  return { budget: rawBudget };
}

export async function updateSpendingBudget(categoryId, input) {
  if (isMockDatabaseEnabled()) {
    return updateMockSpendingBudget(categoryId, input);
  }

  const payload = normalizeBudgetInput(input);

  return withClient(getAppConnectionString(), async (client) => {
    const result = await client.query(
      `
        update spending_categories
        set budget = $2
        where id = $1
        returning id, name, color, spent, budget
      `,
      [categoryId, payload.budget],
    );

    if (!result.rowCount) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: Number(row.id),
      name: row.name,
      color: row.color,
      spent: asNumber(row.spent),
      budget: asNumber(row.budget),
    };
  });
}
