import { getAppConnectionString, withClient } from './db-utils.mjs';

export async function updateChoreDone(choreId, done) {
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
