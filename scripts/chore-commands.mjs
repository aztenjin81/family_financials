import { getAppConnectionString, withClient } from './db-utils.mjs';
import {
  isMockDatabaseEnabled,
  createMockChore,
  deleteMockChore,
  updateMockChore,
  updateMockChoreDone,
} from './mock-db.mjs';

function normalizeChoreInput(chore = {}) {
  const memberSlug = String(chore.memberSlug || chore.member_slug || '').trim();
  const label = String(chore.label || '').trim();
  const reward = Number(chore.reward);

  if (!memberSlug) {
    throw new Error('Member is required');
  }

  if (!label) {
    throw new Error('Chore label is required');
  }

  if (!Number.isFinite(reward) || reward < 0) {
    throw new Error('Chore reward must be a non-negative number');
  }

  return {
    memberSlug,
    label,
    reward: Number(reward.toFixed(2)),
  };
}

function normalizeChoreUpdateInput(chore = {}) {
  const update = {};

  if (chore.memberSlug != null || chore.member_slug != null) {
    const memberSlug = String(chore.memberSlug || chore.member_slug || '').trim();

    if (!memberSlug) {
      throw new Error('Member is required');
    }

    update.memberSlug = memberSlug;
  }

  if (chore.label != null) {
    const label = String(chore.label || '').trim();

    if (!label) {
      throw new Error('Chore label is required');
    }

    update.label = label;
  }

  if (chore.reward != null) {
    const reward = Number(chore.reward);

    if (!Number.isFinite(reward) || reward < 0) {
      throw new Error('Chore reward must be a non-negative number');
    }

    update.reward = Number(reward.toFixed(2));
  }

  if (chore.done != null) {
    if (typeof chore.done !== 'boolean') {
      throw new Error('`done` must be a boolean');
    }

    update.done = chore.done;
  }

  if (!Object.keys(update).length) {
    throw new Error('At least one chore field must be provided');
  }

  return update;
}

export async function updateChoreDone(choreId, done) {
  if (isMockDatabaseEnabled()) {
    return updateMockChoreDone(choreId, done);
  }

  return withClient(getAppConnectionString(), async (client) => {
    const result = await client.query(
      `
        update chores
        set is_done = $2
        where id = $1
        returning id, label, reward, is_done
      `,
      [choreId, done],
    );

    if (!result.rowCount) {
      return null;
    }

    const chore = result.rows[0];
    return {
      id: Number(chore.id),
      label: chore.label,
      reward: Number(chore.reward),
      done: chore.is_done,
    };
  });
}

export async function updateChore(choreId, chore) {
  const input = normalizeChoreUpdateInput(chore);

  if (isMockDatabaseEnabled()) {
    return updateMockChore(choreId, input);
  }

  return withClient(getAppConnectionString(), async (client) => {
    const currentResult = await client.query(
      `
        select chores.id, chores.member_id, household_members.slug as member_slug, chores.label, chores.reward, chores.is_done
        from chores
        join household_members on household_members.id = chores.member_id
        where chores.id = $1
        limit 1
      `,
      [choreId],
    );

    if (!currentResult.rowCount) {
      return null;
    }

    const current = currentResult.rows[0];
    let memberId = current.member_id;

    if (input.memberSlug) {
      const memberResult = await client.query(
        `
          select id
          from household_members
          where slug = $1
          order by id
          limit 1
        `,
        [input.memberSlug],
      );

      if (!memberResult.rowCount) {
        throw new Error('Member not found');
      }

      memberId = memberResult.rows[0].id;
    }

    const nextLabel = input.label ?? current.label;
    const nextReward = input.reward ?? Number(current.reward);
    const nextDone = input.done ?? current.is_done;

    const result = await client.query(
      `
        update chores
        set member_id = $2,
            label = $3,
            reward = $4,
            is_done = $5
        where id = $1
        returning id, label, reward, is_done
      `,
      [choreId, memberId, nextLabel, nextReward, nextDone],
    );

    if (!result.rowCount) {
      return null;
    }

    const choreRow = result.rows[0];
    return {
      id: Number(choreRow.id),
      memberSlug: input.memberSlug ?? current.member_slug,
      label: choreRow.label,
      reward: Number(choreRow.reward),
      done: choreRow.is_done,
    };
  });
}

export async function deleteChore(choreId) {
  if (isMockDatabaseEnabled()) {
    return deleteMockChore(choreId);
  }

  return withClient(getAppConnectionString(), async (client) => {
    const result = await client.query(
      `
        delete from chores
        where id = $1
        returning id
      `,
      [choreId],
    );

    if (!result.rowCount) {
      return null;
    }

    return { id: Number(result.rows[0].id) };
  });
}

export async function createChore(chore) {
  const input = normalizeChoreInput(chore);

  if (isMockDatabaseEnabled()) {
    return createMockChore(input);
  }

  return withClient(getAppConnectionString(), async (client) => {
    const memberResult = await client.query(
      `
        select id
        from household_members
        where slug = $1
        order by id
        limit 1
      `,
      [input.memberSlug],
    );

    if (!memberResult.rowCount) {
      throw new Error('Member not found');
    }

    const memberId = memberResult.rows[0].id;
    const result = await client.query(
      `
        insert into chores (member_id, label, reward, is_done)
        values ($1, $2, $3, false)
        returning id, label, reward, is_done
      `,
      [memberId, input.label, input.reward],
    );

    if (!result.rowCount) {
      return null;
    }

    const choreRow = result.rows[0];
    return {
      id: Number(choreRow.id),
      memberSlug: input.memberSlug,
      label: choreRow.label,
      reward: Number(choreRow.reward),
      done: choreRow.is_done,
    };
  });
}
