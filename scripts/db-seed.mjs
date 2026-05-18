import { DATA } from '../src/data.js';
import { getAllowanceSplit } from '../src/lib/allowance.js';
import { getAgeFromBirthDate } from '../src/lib/age.js';
import { getAppConnectionString, withClient } from './db-utils.mjs';
import { isMockDatabaseEnabled, resetMockDatabase } from './mock-db.mjs';

if (isMockDatabaseEnabled()) {
  resetMockDatabase();
  console.log('Reset mock demo household data.');
} else {
  await withClient(getAppConnectionString(), async (client) => {
    await client.query('begin');

    try {
      await client.query(`
        truncate
          allowance_payments,
          chores,
          kid_jars,
          net_worth_history,
          forecast_weeks,
          debts,
          investment_holdings,
          bills,
          transactions,
          goals,
          spending_categories,
          accounts,
          household_members,
          households
        restart identity cascade
      `);

      const household = await client.query(
        'insert into households (name, as_of, insight, allowance_weekly_amount) values ($1, $2, $3, $4) returning id',
        [DATA.family, '2026-05-11', DATA.insight.text, DATA.allowance?.weeklyAmount ?? 5],
      );
      const householdId = household.rows[0].id;

      const members = new Map();

      for (const member of DATA.members) {
        const result = await client.query(
          'insert into household_members (household_id, slug, display_name, birth_date, age, role) values ($1, $2, $3, $4, $5, $6) returning id',
          [householdId, member.slug, member.name, member.birthDate ?? null, getAgeFromBirthDate(member.birthDate), member.role],
        );
        members.set(member.slug, result.rows[0].id);
      }

      for (const category of DATA.spending) {
        await client.query(
          'insert into spending_categories (household_id, name, color, spent, budget) values ($1, $2, $3, $4, $5)',
          [householdId, category.cat, category.color, category.spent, category.budget],
        );
      }

      for (const [index, value] of DATA.netWorth.history.entries()) {
        await client.query(
          'insert into net_worth_history (household_id, value, sort_order) values ($1, $2, $3)',
          [householdId, value, index],
        );
      }

      for (const [index, week] of DATA.forecast.entries()) {
        await client.query(
          'insert into forecast_weeks (household_id, week_label, incoming, outgoing, sort_order) values ($1, $2, $3, $4, $5)',
          [householdId, week.week, week.in, week.out, index],
        );
      }

      for (const goal of DATA.goals) {
        await client.query(
          'insert into goals (household_id, owner_member_id, name, current_amount, target_amount, color, target_label) values ($1, $2, $3, $4, $5, $6, $7)',
          [householdId, members.get(goal.owner), goal.name, goal.current, goal.target, goal.color, goal.by],
        );
      }

      let transactionOrder = 0;
      for (const group of DATA.transactions) {
        for (const transaction of group.items) {
          await client.query(
            'insert into transactions (household_id, member_id, posted_date, posted_label, merchant, category, amount, time_label, emoji, is_income, sort_order) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
            [householdId, members.get(transaction.who), group.date, group.day, transaction.merch, transaction.cat, transaction.amt, transaction.time, transaction.emoji, Boolean(transaction.income), transactionOrder++],
          );
        }
      }

      for (const bill of DATA.bills) {
        await client.query(
          'insert into bills (household_id, member_id, month_label, day_of_month, name, subtitle, amount, is_soon) values ($1, $2, $3, $4, $5, $6, $7, $8)',
          [householdId, members.get(bill.who), bill.date.m, bill.date.d, bill.name, bill.sub, bill.amt, bill.soon],
        );
      }

      for (const holding of DATA.investments.holdings) {
        await client.query(
          'insert into investment_holdings (household_id, ticker, name, value, daily_change_percent) values ($1, $2, $3, $4, $5)',
          [householdId, holding.tk, holding.name, holding.val, holding.d],
        );
      }

      for (const debt of DATA.debts) {
        await client.query(
          'insert into debts (household_id, name, paid_amount, total_amount, apr, payment_amount, end_label, is_revolving) values ($1, $2, $3, $4, $5, $6, $7, $8)',
          [householdId, debt.name, debt.paid, debt.total, debt.apr, debt.pmt, debt.end, Boolean(debt.revolving)],
        );
      }

      for (const kid of DATA.kids) {
        const memberId = members.get(kid.who);
        await client.query(
          'insert into kid_jars (member_id, spend, save, give) values ($1, $2, $3, $4)',
          [memberId, kid.jars.spend, kid.jars.save, kid.jars.give],
        );

        for (const chore of kid.chores) {
          await client.query(
            'insert into chores (member_id, label, reward, is_done) values ($1, $2, $3, $4)',
            [memberId, chore.label, chore.reward, chore.done],
          );
        }
      }

      const split = getAllowanceSplit(DATA.allowance?.weeklyAmount, DATA.allowance?.split);
      for (const paidAt of DATA.allowancePayments || []) {
        for (const kid of DATA.kids) {
          const memberId = members.get(kid.who);
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
              memberId,
              paidAt,
              split.weeklyAmount,
              split.spend,
              split.save,
              split.give,
            ],
          );
        }
      }

      await client.query('commit');
      console.log('Seeded demo household data.');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  });
}
