import { getAppConnectionString, withClient } from './db-utils.mjs';

function money(value) {
  return Number(value || 0);
}

function byMemberSlug(members, id) {
  return members.find((member) => member.id === id)?.slug ?? null;
}

export async function getDashboardData() {
  return withClient(getAppConnectionString(), async (client) => {
    const householdResult = await client.query(`
      select id, name, as_of, insight
      from households
      order by id
      limit 1
    `);

    if (!householdResult.rowCount) {
      throw new Error('No household data found. Run `npm run db:seed` first.');
    }

    const household = householdResult.rows[0];
    const householdId = household.id;

    const membersResult = await client.query(
      'select id, slug, display_name, age, role from household_members where household_id = $1 order by id',
      [householdId],
    );
    const accountsResult = await client.query(
      'select owner_member_id, account_group, name, subtitle, icon, balance from accounts where household_id = $1 order by sort_order, id',
      [householdId],
    );
    const spendingResult = await client.query(
      'select name, color, spent, budget from spending_categories where household_id = $1 order by id',
      [householdId],
    );
    const netWorthResult = await client.query(
      'select value from net_worth_history where household_id = $1 order by sort_order, id',
      [householdId],
    );
    const forecastResult = await client.query(
      'select week_label, incoming, outgoing from forecast_weeks where household_id = $1 order by sort_order, id',
      [householdId],
    );
    const goalsResult = await client.query(
      'select owner_member_id, name, current_amount, target_amount, color, target_label from goals where household_id = $1 order by id',
      [householdId],
    );
    const transactionsResult = await client.query(
      'select member_id, posted_label, merchant, category, amount, time_label, emoji, is_income from transactions where household_id = $1 order by sort_order, id',
      [householdId],
    );
    const billsResult = await client.query(
      'select member_id, month_label, day_of_month, name, subtitle, amount, is_soon from bills where household_id = $1 order by id',
      [householdId],
    );
    const holdingsResult = await client.query(
      'select ticker, name, value, daily_change_percent from investment_holdings where household_id = $1 order by id',
      [householdId],
    );
    const debtsResult = await client.query(
      'select name, paid_amount, total_amount, apr, payment_amount, end_label, is_revolving from debts where household_id = $1 order by id',
      [householdId],
    );
    const jarsResult = await client.query('select member_id, spend, save, give from kid_jars order by id');
    const choresResult = await client.query('select id, member_id, label, reward, is_done from chores order by id');

    const members = membersResult.rows.map((member) => ({
      ...member,
      id: Number(member.id),
    }));
    const householdMembers = members.map((member) => ({
      slug: member.slug,
      name: member.display_name,
      age: member.age,
      role: member.role,
    }));

    const accountsByGroup = new Map();
    for (const account of accountsResult.rows) {
      if (!accountsByGroup.has(account.account_group)) {
        accountsByGroup.set(account.account_group, []);
      }

      accountsByGroup.get(account.account_group).push({
        name: account.name,
        sub: account.subtitle,
        icon: account.icon,
        bal: money(account.balance),
        owner: byMemberSlug(members, Number(account.owner_member_id)),
      });
    }

    const netWorthHistory = netWorthResult.rows.map((row) => money(row.value));
    const netWorthTotal = netWorthHistory.at(-1) ?? 0;
    const netWorthPrevious = netWorthHistory.at(-2) ?? netWorthTotal;
    const monthSpent = spendingResult.rows.reduce((sum, row) => sum + money(row.spent), 0);
    const monthBudget = spendingResult.rows.reduce((sum, row) => sum + money(row.budget), 0);
    const forecastIncoming = forecastResult.rows.slice(0, 4).reduce((sum, row) => sum + money(row.incoming), 0);
    const forecastOutgoing = forecastResult.rows.slice(0, 4).reduce((sum, row) => sum + money(row.outgoing), 0);
    const holdingsTotal = holdingsResult.rows.reduce((sum, row) => sum + money(row.value), 0);

    const transactionsByDay = new Map();
    const merchantSuggestions = new Set();
    for (const transaction of transactionsResult.rows) {
      if (!transactionsByDay.has(transaction.posted_label)) {
        transactionsByDay.set(transaction.posted_label, []);
      }
      merchantSuggestions.add(transaction.merchant);

      transactionsByDay.get(transaction.posted_label).push({
        emoji: transaction.emoji,
        merch: transaction.merchant,
        cat: transaction.category,
        who: byMemberSlug(members, Number(transaction.member_id)),
        amt: money(transaction.amount),
        time: transaction.time_label,
        income: transaction.is_income,
      });
    }

    const kids = members
      .filter((member) => member.role === 'child')
      .map((member) => {
        const jars = jarsResult.rows.find((row) => Number(row.member_id) === member.id);
        const memberChores = choresResult.rows.filter((row) => Number(row.member_id) === member.id);

        return {
          who: member.slug,
          name: member.display_name,
          age: member.age,
          balance: money(jars?.spend) + money(jars?.save) + money(jars?.give),
          jars: {
            spend: money(jars?.spend),
            save: money(jars?.save),
            give: money(jars?.give),
          },
          chores: memberChores.map((chore) => ({
            id: Number(chore.id),
            label: chore.label,
            reward: money(chore.reward),
            done: chore.is_done,
          })),
        };
      });

    return {
      family: household.name,
      householdMembers,
      merchantSuggestions: [...merchantSuggestions].sort((a, b) => a.localeCompare(b)),
      asOfDate: new Date(household.as_of).toISOString().slice(0, 10),
      asOf: new Date(household.as_of).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      }),
      netWorth: {
        total: netWorthTotal,
        delta30: netWorthTotal - netWorthPrevious,
        deltaPct: netWorthPrevious ? ((netWorthTotal - netWorthPrevious) / netWorthPrevious) * 100 : 0,
        history: netWorthHistory,
      },
      monthSpend: {
        spent: monthSpent,
        budget: monthBudget,
        daysLeft: 20,
      },
      cashflow30: {
        incoming: forecastIncoming,
        outgoing: forecastOutgoing,
        net: forecastIncoming - forecastOutgoing,
      },
      accounts: [...accountsByGroup.entries()].map(([group, items]) => ({ group, items })),
      spending: spendingResult.rows.map((row) => ({
        cat: row.name,
        color: row.color,
        spent: money(row.spent),
        budget: money(row.budget),
      })),
      forecast: forecastResult.rows.map((row) => ({
        week: row.week_label,
        in: money(row.incoming),
        out: money(row.outgoing),
      })),
      goals: goalsResult.rows.map((goal) => ({
        name: goal.name,
        current: money(goal.current_amount),
        target: money(goal.target_amount),
        color: goal.color,
        by: goal.target_label,
        owner: byMemberSlug(members, Number(goal.owner_member_id)),
      })),
      transactions: [...transactionsByDay.entries()].map(([day, items]) => ({ day, items })),
      bills: billsResult.rows.map((bill) => ({
        date: { m: bill.month_label, d: bill.day_of_month },
        name: bill.name,
        sub: bill.subtitle,
        amt: money(bill.amount),
        soon: bill.is_soon,
        who: byMemberSlug(members, Number(bill.member_id)),
      })),
      investments: {
        total: holdingsTotal,
        delta: 0,
        deltaPct: 0,
        holdings: holdingsResult.rows.map((holding) => ({
          tk: holding.ticker,
          name: holding.name,
          val: money(holding.value),
          d: money(holding.daily_change_percent),
        })),
      },
      debts: debtsResult.rows.map((debt) => ({
        name: debt.name,
        paid: money(debt.paid_amount),
        total: money(debt.total_amount),
        apr: money(debt.apr),
        pmt: money(debt.payment_amount),
        end: debt.end_label,
        revolving: debt.is_revolving,
      })),
      kids,
      insight: {
        text: household.insight,
      },
    };
  });
}
