import { getAppConnectionString, withClient } from './db-utils.mjs';
import { getAllowanceSplit } from '../src/lib/allowance.js';
import {
  isMockDatabaseEnabled,
  payMockWeeklyAllowance,
  updateMockHouseholdAllowance,
  voidMockLatestAllowancePayment,
} from './mock-db.mjs';

function asNumber(value) {
  return Number(value || 0);
}

async function ensureAllowanceSchema(client) {
  await client.query(
    'alter table if exists households add column if not exists allowance_weekly_amount numeric(14, 2) not null default 5',
  );
  await client.query(`
    create table if not exists allowance_payments (
      id bigserial primary key,
      household_id bigint not null references households(id) on delete cascade,
      member_id bigint not null references household_members(id) on delete cascade,
      paid_at timestamptz not null default now(),
      weekly_amount numeric(14, 2) not null,
      spend_amount numeric(14, 2) not null,
      save_amount numeric(14, 2) not null,
      give_amount numeric(14, 2) not null
    )
  `);
}

export async function payWeeklyAllowance() {
  if (isMockDatabaseEnabled()) {
    return payMockWeeklyAllowance();
  }

  return withClient(getAppConnectionString(), async (client) => {
    await ensureAllowanceSchema(client);
    await client.query('begin');

    try {
      const householdResult = await client.query(
        `
          select id, allowance_weekly_amount
          from households
          order by id
          limit 1
        `,
      );

      if (!householdResult.rowCount) {
        throw new Error('No household found');
      }

      const householdId = householdResult.rows[0].id;
      const membersResult = await client.query(
        `
          select id, slug, display_name
          from household_members
          where household_id = $1
            and role = 'child'
          order by id
        `,
        [householdId],
      );

      const split = getAllowanceSplit(householdResult.rows[0].allowance_weekly_amount);
      const paidAt = new Date().toISOString();
      const entries = [];

      for (const member of membersResult.rows) {
        const jarResult = await client.query(
          `
            update kid_jars
            set
              spend = spend + $2,
              save = save + $3,
              give = give + $4
            where member_id = $1
            returning spend, save, give
          `,
          [member.id, split.spend, split.save, split.give],
        );

        if (!jarResult.rowCount) {
          throw new Error(`Kid jars not found for ${member.display_name}`);
        }

        await client.query(
          `
            insert into allowance_payments (
              household_id,
              member_id,
              paid_at,
              weekly_amount,
              spend_amount,
              save_amount,
              give_amount
            ) values ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            householdId,
            member.id,
            paidAt,
            split.weeklyAmount,
            split.spend,
            split.save,
            split.give,
          ],
        );

        entries.push({
          memberSlug: member.slug,
          memberName: member.display_name,
          weeklyAmount: split.weeklyAmount,
          spendAmount: split.spend,
          saveAmount: split.save,
          giveAmount: split.give,
        });
      }

      await client.query('commit');

      return {
        allowancePayment: {
          paidAt,
          label: new Date(paidAt).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'UTC',
          }),
          entries,
          total: entries.reduce((sum, entry) => sum + asNumber(entry.weeklyAmount), 0),
        },
      };
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  });
}

export async function updateHouseholdAllowance(input) {
  const weeklyAmount = Number(input.weeklyAmount);

  if (!Number.isFinite(weeklyAmount)) {
    throw new Error('Weekly allowance must be a number');
  }

  if (weeklyAmount <= 0) {
    throw new Error('Weekly allowance must be greater than zero');
  }

  if (isMockDatabaseEnabled()) {
    return updateMockHouseholdAllowance({ weeklyAmount });
  }

  return withClient(getAppConnectionString(), async (client) => {
    await ensureAllowanceSchema(client);
    const result = await client.query(
      `
        update households
        set allowance_weekly_amount = $1
        where id = (
          select id
          from households
          order by id
          limit 1
        )
        returning allowance_weekly_amount
      `,
      [weeklyAmount],
    );

    if (!result.rowCount) {
      throw new Error('No household found');
    }

    return {
      allowance: {
        weeklyAmount: asNumber(result.rows[0].allowance_weekly_amount),
      },
    };
  });
}

export async function voidLatestAllowancePayment() {
  if (isMockDatabaseEnabled()) {
    return voidMockLatestAllowancePayment();
  }

  return withClient(getAppConnectionString(), async (client) => {
    await ensureAllowanceSchema(client);
    await client.query('begin');

    try {
      const householdResult = await client.query(
        `
          select id
          from households
          order by id
          limit 1
        `,
      );

      if (!householdResult.rowCount) {
        throw new Error('No household found');
      }

      const householdId = householdResult.rows[0].id;
      const batchResult = await client.query(
        `
          select paid_at
          from allowance_payments
          where household_id = $1
          group by paid_at
          order by paid_at desc
          limit 1
        `,
        [householdId],
      );

      if (!batchResult.rowCount) {
        throw new Error('No allowance payout found');
      }

      const paidAt = batchResult.rows[0].paid_at;
      const rowsResult = await client.query(
        `
          select
            allowance_payments.id,
            allowance_payments.member_id,
            household_members.slug as member_slug,
            household_members.display_name as member_name,
            allowance_payments.weekly_amount,
            allowance_payments.spend_amount,
            allowance_payments.save_amount,
            allowance_payments.give_amount
          from allowance_payments
          join household_members on household_members.id = allowance_payments.member_id
          where allowance_payments.household_id = $1
            and paid_at = $2
          order by id
        `,
        [householdId, paidAt],
      );

      const reversalAt = new Date(new Date(paidAt).getTime() + 1).toISOString();
      const entries = [];

      for (const row of rowsResult.rows) {
        const jarResult = await client.query(
          `
            update kid_jars
            set
              spend = spend - $2,
              save = save - $3,
              give = give - $4
            where member_id = $1
            returning spend, save, give
          `,
          [row.member_id, row.spend_amount, row.save_amount, row.give_amount],
        );

        if (!jarResult.rowCount) {
          throw new Error('Kid jars not found');
        }

        await client.query(
          `
            insert into allowance_payments (
              household_id,
              member_id,
              paid_at,
              weekly_amount,
              spend_amount,
              save_amount,
              give_amount
            ) values ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            householdId,
            row.member_id,
            reversalAt,
            -Number(row.weekly_amount || 0),
            -Number(row.spend_amount || 0),
            -Number(row.save_amount || 0),
            -Number(row.give_amount || 0),
          ],
        );

        entries.push({
          memberSlug: row.member_slug,
          memberName: row.member_name,
          weeklyAmount: -Number(row.weekly_amount || 0),
          spendAmount: -Number(row.spend_amount || 0),
          saveAmount: -Number(row.save_amount || 0),
          giveAmount: -Number(row.give_amount || 0),
        });
      }

      await client.query('commit');

      return {
        allowanceReversal: {
          paidAt: reversalAt,
          label: new Date(reversalAt).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'UTC',
          }),
          entries,
          total: entries.reduce((sum, entry) => sum + asNumber(entry.weeklyAmount), 0),
        },
      };
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  });
}
