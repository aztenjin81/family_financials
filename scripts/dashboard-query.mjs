import { getAppConnectionString, withClient } from './db-utils.mjs';
import { getAllowanceSplit, groupAllowancePayments } from '../src/lib/allowance.js';
import { getAgeFromBirthDate } from '../src/lib/age.js';
import { getMockDashboardData, isMockDatabaseEnabled } from './mock-db.mjs';
import { getDebtProjection } from '../src/lib/debts.js';
import { getInvestmentPerformance } from '../src/lib/investments.js';
import { formatTransactionDayLabel, parseTransactionDateLabel } from '../src/lib/transaction-date.js';

function money(value) {
  return Number(value || 0);
}

function byMemberSlug(members, id) {
  return members.find((member) => member.id === id)?.slug ?? null;
}

async function ensureAllowanceSchema(client) {
  await client.query(
    'alter table if exists households add column if not exists allowance_weekly_amount numeric(14, 2) not null default 5',
  );
  await client.query('alter table if exists household_members add column if not exists birth_date date');
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

export async function getDashboardData() {
  if (isMockDatabaseEnabled()) {
    return getMockDashboardData();
  }

  return withClient(getAppConnectionString(), async (client) => {
    await ensureAllowanceSchema(client);
    const householdResult = await client.query(`
      select id, name, as_of, insight, allowance_weekly_amount
      from households
      order by id
      limit 1
    `);

    if (!householdResult.rowCount) {
      throw new Error('No household data found. Run `npm run db:seed` first.');
    }

    const household = householdResult.rows[0];
    const householdId = household.id;
    const asOfDate = new Date(household.as_of).toISOString().slice(0, 10);
    const allowanceSplit = getAllowanceSplit(household.allowance_weekly_amount);

    const membersResult = await client.query(
      'select id, slug, display_name, birth_date, age, role from household_members where household_id = $1 order by id',
      [householdId],
    );
    const accountsResult = await client.query(
      'select id, owner_member_id, account_group, name, subtitle, icon, balance, external_provider, external_item_id, external_account_id, imported_at, sync_status from accounts where household_id = $1 order by sort_order, id',
      [householdId],
    );
    const spendingResult = await client.query(
      'select id, name, color, spent, budget from spending_categories where household_id = $1 order by id',
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
      'select id, owner_member_id, name, current_amount, target_amount, color, target_label from goals where household_id = $1 order by id',
      [householdId],
    );
    const transactionsResult = await client.query(
      'select id, member_id, posted_date, posted_label, merchant, category, amount, time_label, emoji, is_income, sync_status from transactions where household_id = $1 order by sort_order, id',
      [householdId],
    );
    const billsResult = await client.query(
      'select id, member_id, month_label, day_of_month, name, subtitle, amount, is_soon, status, external_provider, external_item_id, external_account_id, imported_at, sync_status from bills where household_id = $1 order by id',
      [householdId],
    );
    const holdingsResult = await client.query(
      'select id, ticker, name, value, daily_change_percent from investment_holdings where household_id = $1 order by id',
      [householdId],
    );
    const debtsResult = await client.query(
      'select id, name, paid_amount, total_amount, apr, payment_amount, end_label, is_revolving, current_balance, credit_limit, minimum_payment_amount, next_payment_due_date, last_statement_balance, last_statement_issue_date, last_payment_amount, last_payment_date, apr_type, interest_charge_amount, liability_type, external_provider, external_item_id, external_account_id, imported_at, sync_status from debts where household_id = $1 order by id',
      [householdId],
    );
    const jarsResult = await client.query('select member_id, spend, save, give from kid_jars order by id');
    const allowancePaymentsResult = await client.query(
      `
        select id, member_id, paid_at, weekly_amount, spend_amount, save_amount, give_amount
        from allowance_payments
        where household_id = $1
        order by paid_at desc, id desc
      `,
      [householdId],
    );
    const choresResult = await client.query('select id, member_id, label, reward, is_done from chores order by id');

    const members = membersResult.rows.map((member) => ({
      ...member,
      id: Number(member.id),
      age: getAgeFromBirthDate(member.birth_date) ?? (member.age ?? null),
    }));
    const householdMembers = members.map((member) => ({
      slug: member.slug,
      name: member.display_name,
      age: member.age,
      birthDate: member.birth_date || null,
      role: member.role,
    }));

    const accountsByGroup = new Map();
    for (const account of accountsResult.rows) {
      if (!accountsByGroup.has(account.account_group)) {
        accountsByGroup.set(account.account_group, []);
      }

      accountsByGroup.get(account.account_group).push({
        id: Number(account.id),
        group: account.account_group,
        name: account.name,
        sub: account.subtitle,
        icon: account.icon,
        bal: money(account.balance),
        owner: byMemberSlug(members, Number(account.owner_member_id)),
        externalProvider: account.external_provider,
        externalItemId: account.external_item_id,
        externalAccountId: account.external_account_id,
        importedAt: account.imported_at ? new Date(account.imported_at).toISOString() : null,
        syncStatus: account.sync_status,
      });
    }

    const netWorthHistory = netWorthResult.rows.map((row) => money(row.value));
    const netWorthTotal = netWorthHistory.at(-1) ?? 0;
    const netWorthPrevious = netWorthHistory.at(-2) ?? netWorthTotal;
    const monthSpent = spendingResult.rows.reduce((sum, row) => sum + money(row.spent), 0);
    const monthBudget = spendingResult.rows.reduce((sum, row) => sum + money(row.budget), 0);
    const forecastIncoming = forecastResult.rows.slice(0, 4).reduce((sum, row) => sum + money(row.incoming), 0);
    const forecastOutgoing = forecastResult.rows.slice(0, 4).reduce((sum, row) => sum + money(row.outgoing), 0);
    const investmentPerformance = getInvestmentPerformance(holdingsResult.rows);

    const transactionsByDay = new Map();
    const merchantSuggestions = new Set();
    for (const transaction of transactionsResult.rows) {
      const postedDate = transaction.posted_date
        ? new Date(transaction.posted_date).toISOString().slice(0, 10)
        : parseTransactionDateLabel(transaction.posted_label, asOfDate);
      const dayLabel = transaction.posted_label || formatTransactionDayLabel(postedDate, asOfDate);

      if (!transactionsByDay.has(postedDate)) {
        transactionsByDay.set(postedDate, { day: dayLabel, date: postedDate, items: [] });
      }
      merchantSuggestions.add(transaction.merchant);

        transactionsByDay.get(postedDate).items.push({
          id: Number(transaction.id),
          emoji: transaction.emoji,
          merch: transaction.merchant,
          cat: transaction.category,
          who: byMemberSlug(members, Number(transaction.member_id)),
          amt: money(transaction.amount),
          time: transaction.time_label,
          income: transaction.is_income,
          postedDate,
          syncStatus: transaction.sync_status,
          externalItemId: transaction.external_item_id,
          externalAccountId: transaction.external_account_id,
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
          birthDate: member.birth_date || null,
          balance: money(jars?.spend) + money(jars?.save) + money(jars?.give),
          weeklyAllowance: allowanceSplit.weeklyAmount,
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
    const allowanceHistory = groupAllowancePayments(allowancePaymentsResult.rows.map((row) => ({
      id: Number(row.id),
      paidAt: row.paid_at ? new Date(row.paid_at).toISOString() : null,
      memberSlug: byMemberSlug(members, Number(row.member_id)),
      memberName: members.find((member) => Number(member.id) === Number(row.member_id))?.display_name || byMemberSlug(members, Number(row.member_id)),
      weeklyAmount: money(row.weekly_amount),
      spendAmount: money(row.spend_amount),
      saveAmount: money(row.save_amount),
      giveAmount: money(row.give_amount),
    })));
    return {
      family: household.name,
      householdMembers,
      allowance: {
        weeklyAmount: allowanceSplit.weeklyAmount,
        split: {
          spend: allowanceSplit.spend / allowanceSplit.weeklyAmount,
          save: allowanceSplit.save / allowanceSplit.weeklyAmount,
          give: allowanceSplit.give / allowanceSplit.weeklyAmount,
        },
      },
      allowanceHistory,
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
        id: Number(row.id),
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
        id: Number(goal.id),
        name: goal.name,
        current: money(goal.current_amount),
        target: money(goal.target_amount),
        color: goal.color,
        by: goal.target_label,
        owner: byMemberSlug(members, Number(goal.owner_member_id)),
      })),
      transactions: [...transactionsByDay.values()],
      bills: billsResult.rows.map((bill) => ({
        id: Number(bill.id),
        date: { m: bill.month_label, d: bill.day_of_month },
        name: bill.name,
        sub: bill.subtitle,
        amt: money(bill.amount),
        soon: bill.is_soon,
        who: byMemberSlug(members, Number(bill.member_id)),
        status: bill.status || 'upcoming',
        externalProvider: bill.external_provider,
        externalItemId: bill.external_item_id,
        externalAccountId: bill.external_account_id,
        importedAt: bill.imported_at ? new Date(bill.imported_at).toISOString() : null,
        syncStatus: bill.sync_status,
      })),
      investments: {
        total: investmentPerformance.total,
        delta: investmentPerformance.delta,
        deltaPct: investmentPerformance.deltaPct,
        holdings: holdingsResult.rows.map((holding) => ({
          id: Number(holding.id),
          tk: holding.ticker,
          name: holding.name,
          val: money(holding.value),
          d: money(holding.daily_change_percent),
        })),
      },
      debts: debtsResult.rows.map((debt) => ({
        id: Number(debt.id),
        name: debt.name,
        paid: money(debt.paid_amount),
        total: money(debt.total_amount),
        apr: money(debt.apr),
        pmt: money(debt.payment_amount),
        end: debt.end_label,
        revolving: debt.is_revolving,
        currentBalance: debt.current_balance == null ? null : money(debt.current_balance),
        creditLimit: debt.credit_limit == null ? null : money(debt.credit_limit),
        minimumPaymentAmount: debt.minimum_payment_amount == null ? null : money(debt.minimum_payment_amount),
        nextPaymentDueDate: debt.next_payment_due_date || null,
        lastStatementBalance: debt.last_statement_balance == null ? null : money(debt.last_statement_balance),
        lastStatementIssueDate: debt.last_statement_issue_date || null,
        lastPaymentAmount: debt.last_payment_amount == null ? null : money(debt.last_payment_amount),
        lastPaymentDate: debt.last_payment_date || null,
        aprType: debt.apr_type || null,
        interestChargeAmount: debt.interest_charge_amount == null ? null : money(debt.interest_charge_amount),
        liabilityType: debt.liability_type || null,
        externalProvider: debt.external_provider,
        externalItemId: debt.external_item_id,
        externalAccountId: debt.external_account_id,
        importedAt: debt.imported_at ? new Date(debt.imported_at).toISOString() : null,
        syncStatus: debt.sync_status,
        ...getDebtProjection({
          paid: money(debt.paid_amount),
          total: money(debt.total_amount),
          apr: money(debt.apr),
          pmt: money(debt.payment_amount),
          currentBalance: debt.current_balance == null ? null : money(debt.current_balance),
        }, asOfDate),
      })),
      kids,
      insight: {
        text: household.insight,
      },
    };
  });
}
