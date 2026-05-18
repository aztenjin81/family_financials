import { getAppConnectionString, withClient } from './db-utils.mjs';
import { isMockDatabaseEnabled, addMockGoal, updateMockGoal } from './mock-db.mjs';

function asNumber(value) {
  return Number(value || 0);
}

function normalizeGoalInput(input) {
  const ownerSlug = String(input.ownerSlug || '').trim();
  const name = String(input.name || '').trim();
  const targetLabel = String(input.targetLabel || '').trim();
  const color = String(input.color || '').trim();
  const rawCurrent = Number(input.currentAmount);
  const rawTarget = Number(input.targetAmount);

  if (!ownerSlug) {
    throw new Error('Owner is required');
  }

  if (!name) {
    throw new Error('Goal name is required');
  }

  if (!Number.isFinite(rawCurrent)) {
    throw new Error('Current amount must be a number');
  }

  if (!Number.isFinite(rawTarget)) {
    throw new Error('Target amount must be a number');
  }

  if (rawTarget < 0) {
    throw new Error('Target amount must be zero or greater');
  }

  return {
    ownerSlug,
    name,
    currentAmount: rawCurrent,
    targetAmount: rawTarget,
    color: color || null,
    targetLabel: targetLabel || null,
  };
}

export async function addGoal(input) {
  if (isMockDatabaseEnabled()) {
    return addMockGoal(input);
  }

  const goal = normalizeGoalInput(input);

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
        insert into goals (
          household_id,
          owner_member_id,
          name,
          current_amount,
          target_amount,
          color,
          target_label
        )
        select
          selected_household.id,
          selected_member.id,
          $2,
          $3,
          $4,
          $5,
          $6
        from selected_household, selected_member
        returning id, owner_member_id, name, current_amount, target_amount, color, target_label
      `,
      [
        goal.ownerSlug,
        goal.name,
        goal.currentAmount,
        goal.targetAmount,
        goal.color,
        goal.targetLabel,
      ],
    );

    if (!result.rowCount) {
      throw new Error('Owner not found');
    }

    const row = result.rows[0];
    return {
      id: Number(row.id),
      ownerSlug: goal.ownerSlug,
      name: row.name,
      current: asNumber(row.current_amount),
      target: asNumber(row.target_amount),
      color: row.color,
      by: row.target_label,
    };
  });
}

export async function updateGoal(goalId, input) {
  if (isMockDatabaseEnabled()) {
    return updateMockGoal(goalId, input);
  }

  const goal = normalizeGoalInput(input);

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
        update goals
        set
          owner_member_id = selected_member.id,
          name = $3,
          current_amount = $4,
          target_amount = $5,
          color = $6,
          target_label = $7
        from selected_household, selected_member
        where goals.id = $1
          and goals.household_id = selected_household.id
        returning goals.id, owner_member_id, name, current_amount, target_amount, color, target_label
      `,
      [
        goalId,
        goal.ownerSlug,
        goal.name,
        goal.currentAmount,
        goal.targetAmount,
        goal.color,
        goal.targetLabel,
      ],
    );

    if (!result.rowCount) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: Number(row.id),
      ownerSlug: goal.ownerSlug,
      name: row.name,
      current: asNumber(row.current_amount),
      target: asNumber(row.target_amount),
      color: row.color,
      by: row.target_label,
    };
  });
}
