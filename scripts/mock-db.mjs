import { DATA } from '../src/data.js';
import { getAllowanceSplit, groupAllowancePayments } from '../src/lib/allowance.js';
import { getAgeFromBirthDate } from '../src/lib/age.js';
import { normalizeAccountInput, normalizeImportedAccountInput } from './account-input.mjs';
import { getDebtProjection } from '../src/lib/debts.js';
import { getInvestmentPerformance } from '../src/lib/investments.js';
import { formatTransactionDayLabel, normalizeDateInput, parseTransactionDateLabel } from '../src/lib/transaction-date.js';

function asNumber(value) {
  return Number(value || 0);
}

function clone(value) {
  return structuredClone(value);
}

function isMockDatabaseEnabled() {
  return process.env.USE_MOCK_DB === '1' || process.env.USE_MOCK_DB === 'true';
}

function memberIdBySlug(state, slug) {
  return state.members.find((member) => member.slug === slug)?.id ?? null;
}

function memberSlugById(state, memberId) {
  return state.members.find((member) => member.id === memberId)?.slug ?? null;
}

function nextId(rows) {
  return rows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1;
}

function createInitialState() {
  const household = {
    id: 1,
    name: DATA.family,
    as_of: DATA.asOfDate,
    insight: DATA.insight.text,
    allowance_weekly_amount: DATA.allowance?.weeklyAmount ?? 5,
  };

  const members = DATA.members.map((member, index) => ({
    id: index + 1,
    household_id: household.id,
    slug: member.slug,
    display_name: member.name,
    birth_date: member.birthDate ?? null,
    age: getAgeFromBirthDate(member.birthDate) ?? member.age ?? null,
    role: member.role,
  }));

  const accounts = [];

  const spendingCategories = DATA.spending.map((category, index) => ({
    id: index + 1,
    household_id: household.id,
    name: category.cat,
    color: category.color,
    spent: category.spent,
    budget: category.budget,
  }));

  const netWorthHistory = DATA.netWorth.history.map((value, index) => ({
    id: index + 1,
    household_id: household.id,
    value,
    sort_order: index,
  }));

  const forecastWeeks = DATA.forecast.map((week, index) => ({
    id: index + 1,
    household_id: household.id,
    week_label: week.week,
    incoming: week.in,
    outgoing: week.out,
    sort_order: index,
  }));

  const goals = DATA.goals.map((goal, index) => ({
    id: index + 1,
    household_id: household.id,
    owner_member_id: memberIdBySlug({ members }, goal.owner),
    name: goal.name,
    current_amount: goal.current,
    target_amount: goal.target,
    color: goal.color,
    target_label: goal.by,
  }));

  const transactions = [];
  let transactionSortOrder = 0;
  for (const group of DATA.transactions) {
    const postedDate = parseTransactionDateLabel(group.day, DATA.asOfDate);

    for (const item of group.items) {
      transactions.push({
        id: item.id,
        household_id: household.id,
        member_id: memberIdBySlug({ members }, item.who),
        posted_date: postedDate,
        posted_label: group.day,
        merchant: item.merch,
        category: item.cat,
        amount: item.amt,
        time_label: item.time,
        emoji: item.emoji,
        is_income: Boolean(item.income),
        sort_order: transactionSortOrder += 1,
        external_provider: null,
        external_item_id: null,
        external_account_id: null,
        external_transaction_id: null,
        imported_at: null,
        sync_status: null,
      });
    }
  }

  const bills = DATA.bills.map((bill, index) => ({
    id: index + 1,
    household_id: household.id,
    member_id: memberIdBySlug({ members }, bill.who),
    month_label: bill.date.m,
    day_of_month: bill.date.d,
    name: bill.name,
    subtitle: bill.sub,
    amount: bill.amt,
    is_soon: Boolean(bill.soon),
    status: bill.status || 'upcoming',
    external_provider: null,
    external_item_id: null,
    external_account_id: null,
    imported_at: null,
    sync_status: null,
  }));

  const holdings = DATA.investments.holdings.map((holding, index) => ({
    id: index + 1,
    household_id: household.id,
    ticker: holding.tk,
    name: holding.name,
    value: holding.val,
    daily_change_percent: holding.d,
  }));

  const debts = DATA.debts.map((debt, index) => ({
    id: debt.id ?? index + 1,
    household_id: household.id,
    name: debt.name,
    paid_amount: debt.paid,
    total_amount: debt.total,
    apr: debt.apr ?? null,
    payment_amount: debt.pmt ?? null,
    end_label: debt.end ?? null,
    is_revolving: Boolean(debt.revolving),
    current_balance: null,
    credit_limit: null,
    minimum_payment_amount: null,
    next_payment_due_date: null,
    last_statement_balance: null,
    last_statement_issue_date: null,
    last_payment_amount: null,
    last_payment_date: null,
    apr_type: null,
    interest_charge_amount: null,
    liability_type: null,
    external_provider: null,
    external_item_id: null,
    external_account_id: null,
    imported_at: null,
    sync_status: null,
  }));

  const plaidItems = [];

  const kidJars = [];
  const chores = [];
  const allowancePayments = [];
  const allowanceSplit = getAllowanceSplit(DATA.allowance?.weeklyAmount, DATA.allowance?.split);
  let choreId = 1;
  let allowancePaymentId = 1;
  for (const kid of DATA.kids) {
    const memberId = memberIdBySlug({ members }, kid.who);
    kidJars.push({
      id: kidJars.length + 1,
      member_id: memberId,
      spend: kid.jars.spend,
      save: kid.jars.save,
      give: kid.jars.give,
    });

    for (const chore of kid.chores) {
      chores.push({
        id: choreId++,
        member_id: memberId,
        label: chore.label,
        reward: chore.reward,
        is_done: Boolean(chore.done),
      });
    }
  }

  for (const paidAt of DATA.allowancePayments || []) {
    for (const kid of DATA.kids) {
      const memberId = memberIdBySlug({ members }, kid.who);
      allowancePayments.push({
        id: allowancePaymentId++,
        household_id: household.id,
        member_id: memberId,
        paid_at: paidAt,
        weekly_amount: allowanceSplit.weeklyAmount,
        spend_amount: allowanceSplit.spend,
        save_amount: allowanceSplit.save,
        give_amount: allowanceSplit.give,
      });
    }
  }

  return {
    household,
    members,
    accounts,
    spendingCategories,
    netWorthHistory,
    forecastWeeks,
    goals,
    transactions,
    bills,
    holdings,
    debts,
    plaidItems,
    kidJars,
    chores,
    allowancePayments,
    nextIds: {
      account: nextId(accounts),
      spendingCategory: nextId(spendingCategories),
      netWorthHistory: nextId(netWorthHistory),
      forecastWeek: nextId(forecastWeeks),
      goal: nextId(goals),
      transaction: nextId(transactions),
      bill: nextId(bills),
      holding: nextId(holdings),
      debt: nextId(debts),
      plaidItem: nextId(plaidItems),
      kidJar: nextId(kidJars),
      chore: nextId(chores),
      allowancePayment: nextId(allowancePayments),
    },
  };
}

let mockState = createInitialState();

export function resetMockDatabase() {
  mockState = createInitialState();
  return mockState;
}

export function getMockState() {
  return mockState;
}

function getHousehold() {
  return mockState.household;
}

function getMemberBySlug(slug) {
  return mockState.members.find((member) => member.slug === slug) || null;
}

function getMemberById(memberId) {
  return mockState.members.find((member) => Number(member.id) === Number(memberId)) || null;
}

function getAccountRow(id) {
  return mockState.accounts.find((account) => Number(account.id) === Number(id)) || null;
}

function getSpendingRow(id) {
  return mockState.spendingCategories.find((category) => Number(category.id) === Number(id)) || null;
}

function getGoalRow(id) {
  return mockState.goals.find((goal) => Number(goal.id) === Number(id)) || null;
}

function getBillRow(id) {
  return mockState.bills.find((bill) => Number(bill.id) === Number(id)) || null;
}

function getDebtRow(id) {
  return mockState.debts.find((debt) => Number(debt.id) === Number(id)) || null;
}

function getHoldingRow(id) {
  return mockState.holdings.find((holding) => Number(holding.id) === Number(id)) || null;
}

function getTransactionRow(id) {
  return mockState.transactions.find((transaction) => Number(transaction.id) === Number(id)) || null;
}

function getChoreRow(id) {
  return mockState.chores.find((chore) => Number(chore.id) === Number(id)) || null;
}

function formatAccountRow(row) {
  return {
    id: Number(row.id),
    accountGroup: row.account_group,
    name: row.name,
    subtitle: row.subtitle,
    icon: row.icon,
    balance: asNumber(row.balance),
    ownerSlug: memberSlugById(mockState, row.owner_member_id),
    externalProvider: row.external_provider,
    externalItemId: row.external_item_id,
    externalAccountId: row.external_account_id,
    importedAt: row.imported_at,
    syncStatus: row.sync_status,
  };
}

function formatSpendingRow(row) {
  return {
    id: Number(row.id),
    name: row.name,
    color: row.color,
    spent: asNumber(row.spent),
    budget: asNumber(row.budget),
  };
}

function formatTransactionRow(row) {
  return {
    id: Number(row.id),
    postedDate: normalizeDateInput(row.posted_date),
    postedLabel: row.posted_label,
    merchant: row.merchant,
    category: row.category,
    amount: asNumber(row.amount),
    timeLabel: row.time_label,
    emoji: row.emoji,
    isIncome: Boolean(row.is_income),
    syncStatus: row.sync_status,
  };
}

function upsertMockPlaidTransaction(input) {
  const existing = mockState.transactions.find((row) => (
    row.household_id === input.householdId
    && row.external_provider === input.provider
    && row.external_transaction_id === input.transactionId
  ));

  if (existing) {
    existing.member_id = input.memberId ?? existing.member_id;
    existing.posted_date = input.postedDate;
    existing.posted_label = input.postedLabel;
    existing.merchant = input.merchant;
    existing.category = input.category;
    existing.amount = input.amount;
    existing.time_label = input.timeLabel || null;
    existing.emoji = input.emoji || '•';
    existing.is_income = Boolean(input.isIncome);
    existing.external_item_id = input.itemId || null;
    existing.external_account_id = input.accountId || null;
    existing.imported_at = new Date().toISOString();
    existing.sync_status = input.syncStatus || 'synced';
    return existing;
  }

  const row = {
    id: mockState.nextIds.transaction++,
    household_id: input.householdId,
    member_id: input.memberId ?? null,
    posted_date: input.postedDate,
    posted_label: input.postedLabel,
    merchant: input.merchant,
    category: input.category,
    amount: input.amount,
    time_label: input.timeLabel || null,
    emoji: input.emoji || '•',
    is_income: Boolean(input.isIncome),
    sort_order: (mockState.transactions.reduce((max, item) => Math.max(max, Number(item.sort_order) || 0), -1) + 1),
    external_provider: input.provider || 'plaid',
    external_item_id: input.itemId || null,
    external_account_id: input.accountId || null,
    external_transaction_id: input.transactionId,
    imported_at: new Date().toISOString(),
    sync_status: input.syncStatus || 'synced',
  };

  mockState.transactions.push(row);
  return row;
}

function deleteMockPlaidTransaction(householdId, provider, transactionId) {
  const index = mockState.transactions.findIndex((row) => (
    row.household_id === householdId
    && row.external_provider === provider
    && row.external_transaction_id === transactionId
  ));

  if (index < 0) {
    return null;
  }

  const [row] = mockState.transactions.splice(index, 1);
  return row;
}

function normalizeTransactionInput(input, asOfDate) {
  const defaultDate = normalizeDateInput(asOfDate) || new Date().toISOString().slice(0, 10);
  const merchant = String(input.merchant || '').trim();
  const category = String(input.category || '').trim();
  const memberSlug = String(input.memberSlug || '').trim();
  const postedDate = normalizeDateInput(input.postedDate || defaultDate) || defaultDate;
  const postedLabel = formatTransactionDayLabel(postedDate, defaultDate);
  const timeLabel = String(input.timeLabel || '').trim();
  const emoji = String(input.emoji || '•').trim();
  const isIncome = Boolean(input.isIncome);
  const rawAmount = Number(input.amount);

  if (!merchant) {
    throw new Error('Merchant is required');
  }

  if (!category) {
    throw new Error('Category is required');
  }

  if (!memberSlug) {
    throw new Error('Member is required');
  }

  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    throw new Error('Amount must be greater than zero');
  }

  return {
    merchant,
    category,
    memberSlug,
    postedDate,
    postedLabel,
    timeLabel,
    emoji,
    isIncome,
    amount: isIncome ? rawAmount : -rawAmount,
  };
}

function normalizeTransactionUpdateInput(input, currentTransaction, asOfDate) {
  const defaultDate = normalizeDateInput(asOfDate) || new Date().toISOString().slice(0, 10);
  const postedDate = normalizeDateInput(
    input.postedDate
      || currentTransaction.posted_date
      || parseTransactionDateLabel(currentTransaction.posted_label, defaultDate),
  ) || defaultDate;

  const merged = {
    merchant: String(input.merchant || currentTransaction.merchant || '').trim(),
    category: String(input.category || currentTransaction.category || '').trim(),
    memberSlug: String(input.memberSlug || currentTransaction.member_slug || '').trim(),
    postedDate,
    postedLabel: formatTransactionDayLabel(postedDate, defaultDate),
    timeLabel: String(input.timeLabel || currentTransaction.time_label || '').trim(),
    emoji: String(input.emoji || currentTransaction.emoji || '•').trim(),
    isIncome: input.isIncome == null ? Boolean(currentTransaction.is_income) : Boolean(input.isIncome),
    amount: input.amount == null || input.amount === ''
      ? Math.abs(Number(currentTransaction.amount || 0))
      : Number(input.amount),
  };

  if (!merged.merchant) {
    throw new Error('Merchant is required');
  }

  if (!merged.category) {
    throw new Error('Category is required');
  }

  if (!Number.isFinite(merged.amount) || merged.amount <= 0) {
    throw new Error('Amount must be greater than zero');
  }

  return {
    ...merged,
    amount: merged.isIncome ? merged.amount : -merged.amount,
  };
}

function buildDashboardData() {
  const household = getHousehold();
  const asOfDate = household.as_of;
  const allowanceSplit = getAllowanceSplit(household.allowance_weekly_amount, DATA.allowance?.split);

  const accountsByGroup = new Map();
  for (const account of mockState.accounts.slice().sort((left, right) => left.sort_order - right.sort_order || left.id - right.id)) {
    if (!accountsByGroup.has(account.account_group)) {
      accountsByGroup.set(account.account_group, []);
    }

    accountsByGroup.get(account.account_group).push({
      id: Number(account.id),
      group: account.account_group,
      name: account.name,
      sub: account.subtitle,
      icon: account.icon,
      bal: asNumber(account.balance),
      owner: memberSlugById(mockState, account.owner_member_id),
      externalProvider: account.external_provider,
      externalItemId: account.external_item_id,
      externalAccountId: account.external_account_id,
      importedAt: account.imported_at ? new Date(account.imported_at).toISOString() : null,
      syncStatus: account.sync_status,
    });
  }

  const netWorthHistory = mockState.netWorthHistory.slice().sort((left, right) => left.sort_order - right.sort_order || left.id - right.id);
  const netWorthValues = netWorthHistory.map((row) => asNumber(row.value));
  const netWorthTotal = netWorthValues.at(-1) ?? 0;
  const netWorthPrevious = netWorthValues.at(-2) ?? netWorthTotal;

  const spendingRows = mockState.spendingCategories.slice().sort((left, right) => left.id - right.id);
  const forecastRows = mockState.forecastWeeks.slice().sort((left, right) => left.sort_order - right.sort_order || left.id - right.id);
  const holdingsRows = mockState.holdings.slice().sort((left, right) => left.id - right.id);
  const transactionsRows = mockState.transactions.slice().sort((left, right) => left.sort_order - right.sort_order || left.id - right.id);
  const billsRows = mockState.bills.slice().sort((left, right) => left.id - right.id);
  const debtsRows = mockState.debts.slice().sort((left, right) => left.id - right.id);
  const jarsRows = mockState.kidJars.slice().sort((left, right) => left.id - right.id);
  const choresRows = mockState.chores.slice().sort((left, right) => left.id - right.id);
  const allowancePaymentRows = mockState.allowancePayments
    .slice()
    .sort((left, right) => new Date(right.paid_at).getTime() - new Date(left.paid_at).getTime() || right.id - left.id);

  const transactionsByDay = new Map();
  const merchantSuggestions = new Set();
  for (const transaction of transactionsRows) {
    const postedDate = transaction.posted_date
      ? normalizeDateInput(transaction.posted_date)
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
        who: memberSlugById(mockState, transaction.member_id),
        amt: asNumber(transaction.amount),
        time: transaction.time_label,
        income: Boolean(transaction.is_income),
        postedDate,
        syncStatus: transaction.sync_status,
        externalItemId: transaction.external_item_id,
        externalAccountId: transaction.external_account_id,
      });
    }

  const kids = mockState.members
    .filter((member) => member.role === 'child')
    .map((member) => {
      const jars = jarsRows.find((row) => Number(row.member_id) === member.id);
      const memberChores = choresRows.filter((row) => Number(row.member_id) === member.id);

      return {
        who: member.slug,
        name: member.display_name,
        birthDate: member.birth_date || null,
        age: getAgeFromBirthDate(member.birth_date) ?? member.age ?? null,
        weeklyAllowance: allowanceSplit.weeklyAmount,
        balance: asNumber(jars?.spend) + asNumber(jars?.save) + asNumber(jars?.give),
        jars: {
          spend: asNumber(jars?.spend),
          save: asNumber(jars?.save),
          give: asNumber(jars?.give),
        },
        chores: memberChores.map((chore) => ({
          id: Number(chore.id),
          label: chore.label,
          reward: asNumber(chore.reward),
          done: Boolean(chore.is_done),
        })),
      };
    });
  const allowanceHistory = groupAllowancePayments(allowancePaymentRows.map((row) => ({
    id: Number(row.id),
    paidAt: row.paid_at,
    memberSlug: memberSlugById(mockState, row.member_id),
    memberName: getMemberById(row.member_id)?.display_name || memberSlugById(mockState, row.member_id),
    weeklyAmount: asNumber(row.weekly_amount),
    spendAmount: asNumber(row.spend_amount),
    saveAmount: asNumber(row.save_amount),
    giveAmount: asNumber(row.give_amount),
  })));

  return {
    family: household.name,
    householdMembers: mockState.members.map((member) => ({
      slug: member.slug,
      name: member.display_name,
      birthDate: member.birth_date || null,
      age: getAgeFromBirthDate(member.birth_date) ?? member.age ?? null,
      role: member.role,
    })),
    allowance: {
      weeklyAmount: allowanceSplit.weeklyAmount,
      split: DATA.allowance?.split || {
        spend: 0.5,
        save: 0.3,
        give: 0.2,
      },
    },
    allowanceHistory,
    merchantSuggestions: [...merchantSuggestions].sort((left, right) => left.localeCompare(right)),
    asOfDate,
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
      history: netWorthValues,
    },
    monthSpend: {
      spent: spendingRows.reduce((sum, row) => sum + asNumber(row.spent), 0),
      budget: spendingRows.reduce((sum, row) => sum + asNumber(row.budget), 0),
      daysLeft: 20,
    },
    cashflow30: {
      incoming: forecastRows.slice(0, 4).reduce((sum, row) => sum + asNumber(row.incoming), 0),
      outgoing: forecastRows.slice(0, 4).reduce((sum, row) => sum + asNumber(row.outgoing), 0),
      net: forecastRows.slice(0, 4).reduce((sum, row) => sum + asNumber(row.incoming), 0)
        - forecastRows.slice(0, 4).reduce((sum, row) => sum + asNumber(row.outgoing), 0),
    },
    accounts: [...accountsByGroup.entries()].map(([group, items]) => ({ group, items })),
    spending: spendingRows.map((row) => ({
      id: Number(row.id),
      cat: row.name,
      color: row.color,
      spent: asNumber(row.spent),
      budget: asNumber(row.budget),
    })),
    forecast: forecastRows.map((row) => ({
      week: row.week_label,
      in: asNumber(row.incoming),
      out: asNumber(row.outgoing),
    })),
    goals: mockState.goals
      .slice()
      .sort((left, right) => left.id - right.id)
      .map((goal) => ({
        id: Number(goal.id),
        name: goal.name,
        current: asNumber(goal.current_amount),
        target: asNumber(goal.target_amount),
        color: goal.color,
        by: goal.target_label,
        owner: memberSlugById(mockState, goal.owner_member_id),
      })),
    transactions: [...transactionsByDay.values()],
    bills: billsRows.map((bill) => ({
      id: Number(bill.id),
      date: { m: bill.month_label, d: bill.day_of_month },
      name: bill.name,
      sub: bill.subtitle,
      amt: asNumber(bill.amount),
      soon: Boolean(bill.is_soon),
      who: memberSlugById(mockState, bill.member_id),
      status: bill.status || 'upcoming',
      externalProvider: bill.external_provider,
      externalItemId: bill.external_item_id,
      externalAccountId: bill.external_account_id,
      importedAt: bill.imported_at ? new Date(bill.imported_at).toISOString() : null,
      syncStatus: bill.sync_status,
    })),
    investments: {
      ...getInvestmentPerformance(holdingsRows),
      holdings: holdingsRows.map((holding) => ({
        id: Number(holding.id),
        tk: holding.ticker,
        name: holding.name,
        val: asNumber(holding.value),
        d: asNumber(holding.daily_change_percent),
      })),
    },
    debts: debtsRows.map((debt) => ({
      id: Number(debt.id),
      name: debt.name,
      paid: asNumber(debt.paid_amount),
      total: asNumber(debt.total_amount),
      apr: asNumber(debt.apr),
      pmt: asNumber(debt.payment_amount),
      end: debt.end_label,
      revolving: Boolean(debt.is_revolving),
      currentBalance: debt.current_balance == null ? null : asNumber(debt.current_balance),
      creditLimit: debt.credit_limit == null ? null : asNumber(debt.credit_limit),
      minimumPaymentAmount: debt.minimum_payment_amount == null ? null : asNumber(debt.minimum_payment_amount),
      nextPaymentDueDate: debt.next_payment_due_date || null,
      lastStatementBalance: debt.last_statement_balance == null ? null : asNumber(debt.last_statement_balance),
      lastStatementIssueDate: debt.last_statement_issue_date || null,
      lastPaymentAmount: debt.last_payment_amount == null ? null : asNumber(debt.last_payment_amount),
      lastPaymentDate: debt.last_payment_date || null,
      aprType: debt.apr_type || null,
      interestChargeAmount: debt.interest_charge_amount == null ? null : asNumber(debt.interest_charge_amount),
      liabilityType: debt.liability_type || null,
      externalProvider: debt.external_provider,
      externalItemId: debt.external_item_id,
      externalAccountId: debt.external_account_id,
      importedAt: debt.imported_at ? new Date(debt.imported_at).toISOString() : null,
      syncStatus: debt.sync_status,
      ...getDebtProjection({
        paid: asNumber(debt.paid_amount),
        total: asNumber(debt.total_amount),
        apr: asNumber(debt.apr),
        pmt: asNumber(debt.payment_amount),
        currentBalance: debt.current_balance == null ? null : asNumber(debt.current_balance),
      }, asOfDate),
    })),
    kids,
    insight: {
      text: household.insight,
    },
  };
}

export async function getMockDashboardData() {
  return clone(buildDashboardData());
}

export async function addMockAccount(input) {
  const account = normalizeAccountInput(input);
  const owner = getMemberBySlug(account.ownerSlug);

  if (!owner) {
    throw new Error('Owner not found');
  }

  const row = {
    id: mockState.nextIds.account++,
    household_id: getHousehold().id,
    owner_member_id: owner.id,
    account_group: account.accountGroup,
    name: account.name,
    subtitle: account.subtitle || null,
    icon: account.icon || null,
    balance: account.balance,
    sort_order: (mockState.accounts.reduce((max, item) => Math.max(max, Number(item.sort_order) || 0), -1) + 1),
    external_provider: null,
    external_item_id: null,
    external_account_id: null,
    imported_at: null,
    sync_status: null,
  };

  mockState.accounts.push(row);

  return {
    id: Number(row.id),
    accountGroup: row.account_group,
    name: row.name,
    subtitle: row.subtitle,
    icon: row.icon,
    balance: asNumber(row.balance),
    ownerSlug: account.ownerSlug,
  };
}

export async function updateMockAccount(accountId, input) {
  const account = normalizeAccountInput(input);
  const row = getAccountRow(accountId);

  if (!row) {
    return null;
  }

  const owner = getMemberBySlug(account.ownerSlug);
  if (!owner) {
    return null;
  }

  row.owner_member_id = owner.id;
  row.account_group = account.accountGroup;
  row.name = account.name;
  row.subtitle = account.subtitle || null;
  row.icon = account.icon || null;
  row.balance = account.balance;

  return formatAccountRow(row);
}

export async function syncMockImportedAccount(input) {
  const account = normalizeImportedAccountInput(input);
  const owner = getMemberBySlug(account.ownerSlug);

  if (!owner) {
    throw new Error('Owner not found');
  }

  const now = new Date().toISOString();
  const existing = mockState.accounts.find(
    (row) => row.external_provider === account.provider
      && row.external_account_id === account.externalAccountId,
  );

  if (existing) {
    existing.owner_member_id = owner.id;
    existing.account_group = account.accountGroup;
    existing.name = account.name;
    existing.subtitle = account.subtitle || null;
    existing.icon = account.icon || null;
    existing.balance = account.balance;
    existing.external_item_id = account.externalItemId;
    existing.imported_at = now;
    existing.sync_status = 'synced';

    return {
      ...formatAccountRow(existing),
      inserted: false,
    };
  }

  const row = {
    id: mockState.nextIds.account++,
    household_id: getHousehold().id,
    owner_member_id: owner.id,
    account_group: account.accountGroup,
    name: account.name,
    subtitle: account.subtitle || null,
    icon: account.icon || null,
    balance: account.balance,
    sort_order: (mockState.accounts.reduce((max, item) => Math.max(max, Number(item.sort_order) || 0), -1) + 1),
    external_provider: account.provider,
    external_item_id: account.externalItemId,
    external_account_id: account.externalAccountId,
    imported_at: now,
    sync_status: 'synced',
  };

  mockState.accounts.push(row);

  return {
    ...formatAccountRow(row),
    inserted: true,
  };
}

export async function updateMockSpendingBudget(categoryId, input) {
  const rawBudget = Number(input.budget);

  if (!Number.isFinite(rawBudget)) {
    throw new Error('Budget must be a number');
  }

  if (rawBudget < 0) {
    throw new Error('Budget must be zero or greater');
  }

  const row = getSpendingRow(categoryId);
  if (!row) {
    return null;
  }

  row.budget = rawBudget;
  return formatSpendingRow(row);
}

function normalizeGoalInput(input) {
  const ownerSlug = String(input.ownerSlug || '').trim();
  const name = String(input.name || '').trim();
  const targetLabel = String(input.targetLabel || '').trim();
  const color = String(input.color || '').trim();
  const currentAmount = Number(input.currentAmount);
  const targetAmount = Number(input.targetAmount);

  if (!ownerSlug) {
    throw new Error('Owner is required');
  }

  if (!name) {
    throw new Error('Goal name is required');
  }

  if (!Number.isFinite(currentAmount)) {
    throw new Error('Current amount must be a number');
  }

  if (!Number.isFinite(targetAmount)) {
    throw new Error('Target amount must be a number');
  }

  if (targetAmount < 0) {
    throw new Error('Target amount must be zero or greater');
  }

  return {
    ownerSlug,
    name,
    currentAmount,
    targetAmount,
    color: color || null,
    targetLabel: targetLabel || null,
  };
}

export async function addMockGoal(input) {
  const goal = normalizeGoalInput(input);
  const owner = getMemberBySlug(goal.ownerSlug);

  if (!owner) {
    throw new Error('Owner not found');
  }

  const row = {
    id: mockState.nextIds.goal++,
    household_id: getHousehold().id,
    owner_member_id: owner.id,
    name: goal.name,
    current_amount: goal.currentAmount,
    target_amount: goal.targetAmount,
    color: goal.color,
    target_label: goal.targetLabel,
  };

  mockState.goals.push(row);

  return {
    id: Number(row.id),
    ownerSlug: goal.ownerSlug,
    name: row.name,
    current: asNumber(row.current_amount),
    target: asNumber(row.target_amount),
    color: row.color,
    by: row.target_label,
  };
}

export async function updateMockGoal(goalId, input) {
  const goal = normalizeGoalInput(input);
  const row = getGoalRow(goalId);

  if (!row) {
    return null;
  }

  const owner = getMemberBySlug(goal.ownerSlug);
  if (!owner) {
    return null;
  }

  row.owner_member_id = owner.id;
  row.name = goal.name;
  row.current_amount = goal.currentAmount;
  row.target_amount = goal.targetAmount;
  row.color = goal.color;
  row.target_label = goal.targetLabel;

  return {
    id: Number(row.id),
    ownerSlug: goal.ownerSlug,
    name: row.name,
    current: asNumber(row.current_amount),
    target: asNumber(row.target_amount),
    color: row.color,
    by: row.target_label,
  };
}

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
    value: asNumber(row.value),
    dailyChangePercent: asNumber(row.daily_change_percent),
  };
}

export async function updateMockHolding(holdingId, input) {
  const holding = normalizeHoldingInput(input);
  const row = getHoldingRow(holdingId);

  if (!row) {
    return null;
  }

  row.ticker = holding.ticker;
  row.name = holding.name;
  row.value = holding.value;
  row.daily_change_percent = holding.dailyChangePercent;

  return formatHoldingRow(row);
}

function normalizeBillInput(input) {
  const memberSlug = String(input.memberSlug || '').trim();
  const monthLabel = String(input.monthLabel || '').trim();
  const name = String(input.name || '').trim();
  const subtitle = String(input.subtitle || '').trim();
  const status = String(input.status || 'upcoming').trim() || 'upcoming';
  const dayOfMonth = Number(input.dayOfMonth);
  const amount = Number(input.amount);
  const isSoon = input.isSoon == null ? false : Boolean(input.isSoon);

  if (!memberSlug) {
    throw new Error('Member is required');
  }

  if (!monthLabel) {
    throw new Error('Month label is required');
  }

  if (!name) {
    throw new Error('Bill name is required');
  }

  if (!Number.isFinite(dayOfMonth) || dayOfMonth < 1) {
    throw new Error('Day of month must be a positive number');
  }

  if (!Number.isFinite(amount)) {
    throw new Error('Amount must be a number');
  }

  if (amount < 0) {
    throw new Error('Amount must be zero or greater');
  }

  if (!['upcoming', 'paid', 'snoozed'].includes(status)) {
    throw new Error('Status must be upcoming, paid, or snoozed');
  }

  return {
    memberSlug,
    monthLabel,
    dayOfMonth: Math.trunc(dayOfMonth),
    name,
    subtitle: subtitle || null,
    amount,
    isSoon,
    status,
  };
}

function formatBillRow(row) {
  return {
    id: Number(row.id),
    monthLabel: row.month_label,
    dayOfMonth: Number(row.day_of_month),
    name: row.name,
    subtitle: row.subtitle,
    amount: asNumber(row.amount),
    memberSlug: row.member_slug,
    isSoon: Boolean(row.is_soon),
    status: row.status || 'upcoming',
  };
}

function formatPlaidBillRow(row) {
  return {
    id: Number(row.id),
    monthLabel: row.month_label,
    dayOfMonth: Number(row.day_of_month),
    name: row.name,
    subtitle: row.subtitle,
    amount: asNumber(row.amount),
    memberSlug: memberSlugById(mockState, row.member_id),
    isSoon: Boolean(row.is_soon),
    status: row.status || 'upcoming',
    externalProvider: row.external_provider,
    externalItemId: row.external_item_id,
    externalAccountId: row.external_account_id,
    importedAt: row.imported_at,
    syncStatus: row.sync_status,
  };
}

function formatDebtRow(row) {
  return {
    id: Number(row.id),
    name: row.name,
    paid: asNumber(row.paid_amount),
    total: asNumber(row.total_amount),
    apr: row.apr == null ? null : asNumber(row.apr),
    pmt: row.payment_amount == null ? null : asNumber(row.payment_amount),
    end: row.end_label,
    revolving: Boolean(row.is_revolving),
    currentBalance: row.current_balance == null ? null : asNumber(row.current_balance),
    creditLimit: row.credit_limit == null ? null : asNumber(row.credit_limit),
    minimumPaymentAmount: row.minimum_payment_amount == null ? null : asNumber(row.minimum_payment_amount),
    nextPaymentDueDate: row.next_payment_due_date || null,
    lastStatementBalance: row.last_statement_balance == null ? null : asNumber(row.last_statement_balance),
    lastStatementIssueDate: row.last_statement_issue_date || null,
    lastPaymentAmount: row.last_payment_amount == null ? null : asNumber(row.last_payment_amount),
    lastPaymentDate: row.last_payment_date || null,
    aprType: row.apr_type || null,
    interestChargeAmount: row.interest_charge_amount == null ? null : asNumber(row.interest_charge_amount),
    liabilityType: row.liability_type || null,
    externalProvider: row.external_provider,
    externalItemId: row.external_item_id,
    externalAccountId: row.external_account_id,
    importedAt: row.imported_at,
    syncStatus: row.sync_status,
  };
}

export async function addMockBill(input) {
  const bill = normalizeBillInput(input);
  const member = getMemberBySlug(bill.memberSlug);

  if (!member) {
    throw new Error('Member not found');
  }

  const row = {
    id: mockState.nextIds.bill++,
    household_id: getHousehold().id,
    member_id: member.id,
    month_label: bill.monthLabel,
    day_of_month: bill.dayOfMonth,
    name: bill.name,
    subtitle: bill.subtitle,
    amount: bill.amount,
    is_soon: bill.isSoon,
    status: bill.status,
  };

  mockState.bills.push(row);

  return formatBillRow({
    ...row,
    member_slug: bill.memberSlug,
  });
}

export async function updateMockBill(billId, input) {
  const bill = normalizeBillInput(input);
  const row = getBillRow(billId);

  if (!row) {
    return null;
  }

  const member = getMemberBySlug(bill.memberSlug);
  if (!member) {
    return null;
  }

  row.member_id = member.id;
  row.month_label = bill.monthLabel;
  row.day_of_month = bill.dayOfMonth;
  row.name = bill.name;
  row.subtitle = bill.subtitle;
  row.amount = bill.amount;
  row.is_soon = bill.isSoon;
  row.status = bill.status;

  return formatBillRow({
    ...row,
    member_slug: bill.memberSlug,
  });
}

function normalizePlaidBillInput(input) {
  const memberSlug = String(input.memberSlug || input.ownerSlug || 'john').trim() || 'john';
  const monthLabel = String(input.monthLabel || '').trim() || 'Soon';
  const name = String(input.name || '').trim();
  const subtitle = String(input.subtitle || '').trim();
  const amount = Number(input.amount);
  const dayOfMonth = Number(input.dayOfMonth);
  const isSoon = input.isSoon == null ? false : Boolean(input.isSoon);
  const status = String(input.status || 'upcoming').trim() || 'upcoming';

  if (!name) {
    throw new Error('Bill name is required');
  }

  if (!Number.isFinite(amount)) {
    throw new Error('Amount must be a number');
  }

  return {
    memberSlug,
    monthLabel,
    dayOfMonth: Number.isFinite(dayOfMonth) && dayOfMonth > 0 ? Math.trunc(dayOfMonth) : 1,
    name,
    subtitle: subtitle || null,
    amount,
    isSoon,
    status,
    externalProvider: String(input.provider || 'plaid').trim() || 'plaid',
    externalItemId: String(input.externalItemId || '').trim() || null,
    externalAccountId: String(input.externalAccountId || '').trim() || null,
    importedAt: input.importedAt ? new Date(input.importedAt).toISOString() : new Date().toISOString(),
    syncStatus: String(input.syncStatus || 'synced').trim() || 'synced',
  };
}

export async function upsertMockPlaidBill(input) {
  const bill = normalizePlaidBillInput(input);
  const member = getMemberBySlug(bill.memberSlug);

  if (!member) {
    throw new Error('Member not found');
  }

  const existing = mockState.bills.find((row) => (
    row.household_id === getHousehold().id
    && row.external_provider === bill.externalProvider
    && row.external_account_id === bill.externalAccountId
  ));

  if (existing) {
    existing.member_id = member.id;
    existing.month_label = bill.monthLabel;
    existing.day_of_month = bill.dayOfMonth;
    existing.name = bill.name;
    existing.subtitle = bill.subtitle;
    existing.amount = bill.amount;
    existing.is_soon = bill.isSoon;
    existing.status = bill.status;
    existing.external_item_id = bill.externalItemId;
    existing.imported_at = bill.importedAt;
    existing.sync_status = bill.syncStatus;
    return formatPlaidBillRow(existing);
  }

  const row = {
    id: mockState.nextIds.bill++,
    household_id: getHousehold().id,
    member_id: member.id,
    month_label: bill.monthLabel,
    day_of_month: bill.dayOfMonth,
    name: bill.name,
    subtitle: bill.subtitle,
    amount: bill.amount,
    is_soon: bill.isSoon,
    status: bill.status,
    external_provider: bill.externalProvider,
    external_item_id: bill.externalItemId,
    external_account_id: bill.externalAccountId,
    imported_at: bill.importedAt,
    sync_status: bill.syncStatus,
  };

  mockState.bills.push(row);
  return formatPlaidBillRow(row);
}

function normalizePlaidDebtInput(input) {
  const ownerSlug = String(input.ownerSlug || 'john').trim() || 'john';
  const name = String(input.name || '').trim();
  const paid = Number(input.paid);
  const total = Number(input.total);
  const currentBalance = input.currentBalance == null || input.currentBalance === '' ? null : Number(input.currentBalance);
  const creditLimit = input.creditLimit == null || input.creditLimit === '' ? null : Number(input.creditLimit);
  const minimumPaymentAmount = input.minimumPaymentAmount == null || input.minimumPaymentAmount === '' ? null : Number(input.minimumPaymentAmount);
  const nextPaymentDueDate = String(input.nextPaymentDueDate || '').trim() || null;
  const lastStatementBalance = input.lastStatementBalance == null || input.lastStatementBalance === '' ? null : Number(input.lastStatementBalance);
  const lastStatementIssueDate = String(input.lastStatementIssueDate || '').trim() || null;
  const lastPaymentAmount = input.lastPaymentAmount == null || input.lastPaymentAmount === '' ? null : Number(input.lastPaymentAmount);
  const lastPaymentDate = String(input.lastPaymentDate || '').trim() || null;
  const apr = input.apr == null || input.apr === '' ? null : Number(input.apr);
  const aprType = String(input.aprType || '').trim() || null;
  const interestChargeAmount = input.interestChargeAmount == null || input.interestChargeAmount === '' ? null : Number(input.interestChargeAmount);
  const pmt = Number(input.pmt);
  const end = String(input.end || '').trim();
  const revolving = Boolean(input.revolving);
  const liabilityType = String(input.liabilityType || '').trim() || null;
  const externalProvider = String(input.provider || 'plaid').trim() || 'plaid';
  const externalItemId = String(input.externalItemId || '').trim() || null;
  const externalAccountId = String(input.externalAccountId || '').trim() || null;
  const importedAt = input.importedAt ? new Date(input.importedAt).toISOString() : new Date().toISOString();
  const syncStatus = String(input.syncStatus || 'synced').trim() || 'synced';

  if (!name) {
    throw new Error('Debt name is required');
  }

  if (!Number.isFinite(paid) || paid < 0) {
    throw new Error('Paid amount must be zero or greater');
  }

  if (!Number.isFinite(total) || total < 0) {
    throw new Error('Total amount must be zero or greater');
  }

  if (!Number.isFinite(pmt) || pmt < 0) {
    throw new Error('Payment amount must be zero or greater');
  }

  return {
    ownerSlug,
    name,
    paid,
    total,
    currentBalance,
    creditLimit,
    minimumPaymentAmount,
    nextPaymentDueDate,
    lastStatementBalance,
    lastStatementIssueDate,
    lastPaymentAmount,
    lastPaymentDate,
    apr,
    aprType,
    interestChargeAmount,
    pmt,
    end: end || null,
    revolving,
    liabilityType,
    externalProvider,
    externalItemId,
    externalAccountId,
    importedAt,
    syncStatus,
  };
}

export async function upsertMockPlaidDebt(input) {
  const debt = normalizePlaidDebtInput(input);
  const owner = getMemberBySlug(debt.ownerSlug);

  if (!owner) {
    throw new Error('Owner not found');
  }

  const existing = mockState.debts.find((row) => (
    row.household_id === getHousehold().id
    && row.external_provider === debt.externalProvider
    && row.external_account_id === debt.externalAccountId
  ));

  if (existing) {
    existing.name = debt.name;
    existing.paid_amount = debt.paid;
    existing.total_amount = debt.total;
    existing.current_balance = debt.currentBalance;
    existing.credit_limit = debt.creditLimit;
    existing.minimum_payment_amount = debt.minimumPaymentAmount;
    existing.next_payment_due_date = debt.nextPaymentDueDate;
    existing.last_statement_balance = debt.lastStatementBalance;
    existing.last_statement_issue_date = debt.lastStatementIssueDate;
    existing.last_payment_amount = debt.lastPaymentAmount;
    existing.last_payment_date = debt.lastPaymentDate;
    existing.apr = debt.apr;
    existing.apr_type = debt.aprType;
    existing.interest_charge_amount = debt.interestChargeAmount;
    existing.payment_amount = debt.pmt;
    existing.end_label = debt.end;
    existing.is_revolving = debt.revolving;
    existing.liability_type = debt.liabilityType;
    existing.external_item_id = debt.externalItemId;
    existing.imported_at = debt.importedAt;
    existing.sync_status = debt.syncStatus;
    return formatDebtRow(existing);
  }

  const row = {
    id: mockState.nextIds.debt++,
    household_id: getHousehold().id,
    name: debt.name,
    paid_amount: debt.paid,
    total_amount: debt.total,
    current_balance: debt.currentBalance,
    credit_limit: debt.creditLimit,
    minimum_payment_amount: debt.minimumPaymentAmount,
    next_payment_due_date: debt.nextPaymentDueDate,
    last_statement_balance: debt.lastStatementBalance,
    last_statement_issue_date: debt.lastStatementIssueDate,
    last_payment_amount: debt.lastPaymentAmount,
    last_payment_date: debt.lastPaymentDate,
    apr: debt.apr,
    apr_type: debt.aprType,
    interest_charge_amount: debt.interestChargeAmount,
    payment_amount: debt.pmt,
    end_label: debt.end,
    is_revolving: debt.revolving,
    liability_type: debt.liabilityType,
    external_provider: debt.externalProvider,
    external_item_id: debt.externalItemId,
    external_account_id: debt.externalAccountId,
    imported_at: debt.importedAt,
    sync_status: debt.syncStatus,
  };

  mockState.debts.push(row);
  return formatDebtRow(row);
}

export async function deleteMockDebt(debtId) {
  const index = mockState.debts.findIndex((debt) => Number(debt.id) === Number(debtId));

  if (index < 0) {
    return null;
  }

  const [row] = mockState.debts.splice(index, 1);
  return {
    id: Number(row.id),
  };
}

export async function setMockBillStatus(billId, status) {
  const row = getBillRow(billId);

  if (!row) {
    return null;
  }

  row.status = status;
  row.is_soon = status === 'upcoming' ? row.is_soon : false;

  return formatBillRow({
    ...row,
    member_slug: memberSlugById(mockState, row.member_id),
  });
}

export async function updateMockChoreDone(choreId, done) {
  const row = getChoreRow(choreId);
  if (!row) {
    return null;
  }

  row.is_done = Boolean(done);
  return {
    id: Number(row.id),
    label: row.label,
    reward: asNumber(row.reward),
    done: Boolean(row.is_done),
  };
}

export async function updateMockChore(choreId, chore) {
  const row = getChoreRow(choreId);

  if (!row) {
    return null;
  }

  if (chore.memberSlug) {
    const member = mockState.members.find((entry) => entry.slug === chore.memberSlug);

    if (!member) {
      throw new Error('Member not found');
    }

    row.member_id = member.id;
  }

  if (chore.label != null) {
    row.label = chore.label;
  }

  if (chore.reward != null) {
    row.reward = chore.reward;
  }

  if (chore.done != null) {
    row.is_done = Boolean(chore.done);
  }

  return {
    id: Number(row.id),
    memberSlug: memberSlugById(mockState, row.member_id),
    label: row.label,
    reward: asNumber(row.reward),
    done: Boolean(row.is_done),
  };
}

export async function deleteMockChore(choreId) {
  const index = mockState.chores.findIndex((chore) => Number(chore.id) === Number(choreId));

  if (index < 0) {
    return null;
  }

  const [row] = mockState.chores.splice(index, 1);
  return {
    id: Number(row.id),
  };
}

export async function createMockChore(chore) {
  const member = mockState.members.find((entry) => entry.slug === chore.memberSlug);

  if (!member) {
    throw new Error('Member not found');
  }

  const row = {
    id: mockState.nextIds.chore++,
    member_id: member.id,
    label: chore.label,
    reward: chore.reward,
    is_done: false,
  };

  mockState.chores.push(row);

  return {
    id: Number(row.id),
    memberSlug: member.slug,
    label: row.label,
    reward: asNumber(row.reward),
    done: Boolean(row.is_done),
  };
}

export async function payMockWeeklyAllowance() {
  const household = getHousehold();
  const paidAt = new Date().toISOString();
  const split = getAllowanceSplit(household.allowance_weekly_amount, DATA.allowance?.split);
  const children = mockState.members.filter((member) => member.household_id === household.id && member.role === 'child');
  const entries = [];

  for (const member of children) {
    const jarRow = mockState.kidJars.find((row) => Number(row.member_id) === Number(member.id));

    if (!jarRow) {
      throw new Error(`Kid jars not found for ${member.display_name}`);
    }

    jarRow.spend += split.spend;
    jarRow.save += split.save;
    jarRow.give += split.give;

    const paymentRow = {
      id: mockState.nextIds.allowancePayment++,
      household_id: household.id,
      member_id: member.id,
      paid_at: paidAt,
      weekly_amount: split.weeklyAmount,
      spend_amount: split.spend,
      save_amount: split.save,
      give_amount: split.give,
    };
    mockState.allowancePayments.push(paymentRow);

    entries.push({
      id: Number(paymentRow.id),
      memberSlug: member.slug,
      memberName: member.display_name,
      weeklyAmount: split.weeklyAmount,
      spendAmount: split.spend,
      saveAmount: split.save,
      giveAmount: split.give,
    });
  }

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
      total: entries.reduce((sum, entry) => sum + entry.weeklyAmount, 0),
    },
  };
}

export async function voidMockLatestAllowancePayment() {
  const household = getHousehold();
  const batches = groupAllowancePayments(
    mockState.allowancePayments.map((row) => ({
      id: Number(row.id),
      paidAt: row.paid_at,
      memberSlug: memberSlugById(mockState, row.member_id),
      memberName: getMemberById(row.member_id)?.display_name || memberSlugById(mockState, row.member_id),
      weeklyAmount: asNumber(row.weekly_amount),
      spendAmount: asNumber(row.spend_amount),
      saveAmount: asNumber(row.save_amount),
      giveAmount: asNumber(row.give_amount),
    })),
  );
  const latestBatch = batches[0];

  if (!latestBatch) {
    throw new Error('No allowance payout found');
  }

  const reversalAt = new Date(new Date(latestBatch.paidAt).getTime() + 1).toISOString();
  const entries = [];

  for (const entry of latestBatch.entries) {
    const member = getMemberBySlug(entry.memberSlug);

    if (!member) {
      throw new Error(`Kid not found for ${entry.memberName}`);
    }

    const jarRow = mockState.kidJars.find((row) => Number(row.member_id) === Number(member.id));

    if (!jarRow) {
      throw new Error(`Kid jars not found for ${member.display_name}`);
    }

    jarRow.spend -= entry.spendAmount;
    jarRow.save -= entry.saveAmount;
    jarRow.give -= entry.giveAmount;

    const paymentRow = {
      id: mockState.nextIds.allowancePayment++,
      household_id: household.id,
      member_id: member.id,
      paid_at: reversalAt,
      weekly_amount: -entry.weeklyAmount,
      spend_amount: -entry.spendAmount,
      save_amount: -entry.saveAmount,
      give_amount: -entry.giveAmount,
    };
    mockState.allowancePayments.push(paymentRow);

    entries.push({
      id: Number(paymentRow.id),
      memberSlug: member.slug,
      memberName: member.display_name,
      weeklyAmount: paymentRow.weekly_amount,
      spendAmount: paymentRow.spend_amount,
      saveAmount: paymentRow.save_amount,
      giveAmount: paymentRow.give_amount,
    });
  }

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
      total: entries.reduce((sum, entry) => sum + entry.weeklyAmount, 0),
    },
  };
}

export async function updateMockHouseholdAllowance(input) {
  const weeklyAmount = Number(input.weeklyAmount);

  if (!Number.isFinite(weeklyAmount)) {
    throw new Error('Weekly allowance must be a number');
  }

  if (weeklyAmount <= 0) {
    throw new Error('Weekly allowance must be greater than zero');
  }

  const household = getHousehold();
  household.allowance_weekly_amount = Number(weeklyAmount.toFixed(2));

  return {
    allowance: {
      weeklyAmount: household.allowance_weekly_amount,
    },
  };
}

export async function addMockTransaction(input) {
  const household = getHousehold();
  const transaction = normalizeTransactionInput(input, household.as_of);
  const member = getMemberBySlug(transaction.memberSlug);

  if (!member) {
    throw new Error('Member not found');
  }

  const row = {
    id: mockState.nextIds.transaction++,
    household_id: household.id,
    member_id: member.id,
    posted_date: transaction.postedDate,
    posted_label: transaction.postedLabel,
    merchant: transaction.merchant,
    category: transaction.category,
    amount: transaction.amount,
    time_label: transaction.timeLabel,
    emoji: transaction.emoji,
    is_income: transaction.isIncome,
    sort_order: (mockState.transactions.reduce((max, item) => Math.max(max, Number(item.sort_order) || 0), -1) + 1),
  };

  mockState.transactions.push(row);
  return formatTransactionRow(row);
}

export async function updateMockTransaction(transactionId, input) {
  const currentTransaction = mockState.transactions.find((row) => Number(row.id) === Number(transactionId));

  if (!currentTransaction) {
    return null;
  }

  const transaction = {
    ...normalizeTransactionUpdateInput(
      input,
      {
        ...currentTransaction,
        member_slug: memberSlugById(mockState, currentTransaction.member_id),
        as_of: getHousehold().as_of,
      },
      getHousehold().as_of,
    ),
  };

  const member = transaction.memberSlug ? getMemberBySlug(transaction.memberSlug) : null;
  if (member) {
    currentTransaction.member_id = member.id;
  }

  currentTransaction.posted_date = transaction.postedDate;
  currentTransaction.posted_label = transaction.postedLabel;
  currentTransaction.merchant = transaction.merchant;
  currentTransaction.category = transaction.category;
  currentTransaction.amount = transaction.amount;
  currentTransaction.time_label = transaction.timeLabel;
  currentTransaction.emoji = transaction.emoji;
  currentTransaction.is_income = transaction.isIncome;

  return formatTransactionRow(currentTransaction);
}

export async function deleteMockTransaction(transactionId) {
  const index = mockState.transactions.findIndex((row) => Number(row.id) === Number(transactionId));
  if (index < 0) {
    return null;
  }

  const [row] = mockState.transactions.splice(index, 1);
  return {
    id: Number(row.id),
  };
}

export async function deleteMockAccount(accountId) {
  const index = mockState.accounts.findIndex((row) => Number(row.id) === Number(accountId));
  if (index < 0) {
    return null;
  }

  const [row] = mockState.accounts.splice(index, 1);
  return {
    id: Number(row.id),
  };
}

export async function deleteMockImportedAccount(provider, externalAccountId) {
  const before = mockState.accounts.length;
  mockState.accounts = mockState.accounts.filter((row) => !(
    row.external_provider === provider && row.external_account_id === externalAccountId
  ));
  return before - mockState.accounts.length;
}

function upsertMockPlaidItem(input) {
  const existing = mockState.plaidItems.find((item) => (
    item.household_id === input.householdId
    && item.provider === input.provider
    && item.item_id === input.itemId
  ));

  if (existing) {
    existing.access_token = input.accessToken;
    existing.institution_name = input.institutionName || null;
    existing.link_session_id = input.linkSessionId || null;
    existing.sync_status = input.syncStatus || 'linked';
    existing.updated_at = new Date().toISOString();
    return existing;
  }

  const row = {
    id: mockState.nextIds.plaidItem++,
    household_id: input.householdId,
    provider: input.provider || 'plaid',
    item_id: input.itemId,
    access_token: input.accessToken,
    institution_name: input.institutionName || null,
    link_session_id: input.linkSessionId || null,
    transaction_cursor: input.transactionCursor || null,
    sync_status: input.syncStatus || 'linked',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  mockState.plaidItems.push(row);
  return row;
}

export function createMockClient() {
  let snapshot = null;

  return {
    async connect() {},
    async end() {},
    async query(text, params = []) {
      const normalized = String(text || '').trim().replace(/\s+/g, ' ').toLowerCase();

      if (normalized === 'begin') {
        snapshot = clone(mockState);
        return { rowCount: 0, rows: [] };
      }

      if (normalized === 'commit') {
        snapshot = null;
        return { rowCount: 0, rows: [] };
      }

      if (normalized === 'rollback') {
        if (snapshot) {
          mockState = snapshot;
        }
        snapshot = null;
        return { rowCount: 0, rows: [] };
      }

      if (normalized === 'select 1 from pg_database where datname = $1') {
        return { rowCount: 1, rows: [{ '?column?': 1 }] };
      }

      if (normalized === 'delete from transactions where id = $1 returning id') {
        const result = await deleteMockTransaction(params[0]);
        return result
          ? { rowCount: 1, rows: [{ id: result.id }] }
          : { rowCount: 0, rows: [] };
      }

      if (normalized === 'delete from transactions where id = $1') {
        const result = await deleteMockTransaction(params[0]);
        return result
          ? { rowCount: 1, rows: [] }
          : { rowCount: 0, rows: [] };
      }

      if (normalized === 'delete from accounts where id = $1 returning id') {
        const result = await deleteMockAccount(params[0]);
        return result
          ? { rowCount: 1, rows: [{ id: result.id }] }
          : { rowCount: 0, rows: [] };
      }

      if (normalized === 'delete from accounts where id = $1') {
        const result = await deleteMockAccount(params[0]);
        return result
          ? { rowCount: 1, rows: [] }
          : { rowCount: 0, rows: [] };
      }

      if (normalized === 'delete from accounts where external_provider = $1 and external_account_id = $2') {
        const count = await deleteMockImportedAccount(params[0], params[1]);
        return { rowCount: count, rows: [] };
      }

      if (normalized === 'delete from goals where id = $1') {
        const index = mockState.goals.findIndex((goal) => Number(goal.id) === Number(params[0]));
        if (index < 0) {
          return { rowCount: 0, rows: [] };
        }

        mockState.goals.splice(index, 1);
        return { rowCount: 1, rows: [] };
      }

      if (normalized === 'delete from bills where id = $1 returning id') {
        const index = mockState.bills.findIndex((bill) => Number(bill.id) === Number(params[0]));
        if (index < 0) {
          return { rowCount: 0, rows: [] };
        }

        const [removed] = mockState.bills.splice(index, 1);
        return { rowCount: 1, rows: [{ id: removed.id }] };
      }

      if (normalized === 'delete from bills where id = $1') {
        const index = mockState.bills.findIndex((bill) => Number(bill.id) === Number(params[0]));
        if (index < 0) {
          return { rowCount: 0, rows: [] };
        }

        mockState.bills.splice(index, 1);
        return { rowCount: 1, rows: [] };
      }

      if (normalized === 'delete from debts where id = $1 returning id') {
        const result = await deleteMockDebt(params[0]);
        return result
          ? { rowCount: 1, rows: [{ id: result.id }] }
          : { rowCount: 0, rows: [] };
      }

      if (normalized === 'delete from debts where id = $1') {
        const result = await deleteMockDebt(params[0]);
        return result
          ? { rowCount: 1, rows: [] }
          : { rowCount: 0, rows: [] };
      }

      if (normalized.startsWith('insert into plaid_items')) {
        const row = upsertMockPlaidItem({
          householdId: params[0],
          provider: params[1],
          itemId: params[2],
          accessToken: params[3],
          institutionName: params[4],
          linkSessionId: params[5],
          syncStatus: params[6],
        });

        return {
          rowCount: 1,
          rows: [{
            id: row.id,
            household_id: row.household_id,
            provider: row.provider,
            item_id: row.item_id,
            institution_name: row.institution_name,
            link_session_id: row.link_session_id,
            transaction_cursor: row.transaction_cursor,
            sync_status: row.sync_status,
          }],
        };
      }

      if (normalized === 'select id, household_id, provider, item_id, access_token, institution_name, link_session_id, transaction_cursor, sync_status from plaid_items where household_id = $1 and provider = $2 and item_id = $3 order by id' || normalized === 'select id, household_id, provider, item_id, access_token, institution_name, link_session_id, transaction_cursor, sync_status from plaid_items where household_id = $1 and provider = $2 and item_id = $3') {
        const rows = mockState.plaidItems.filter((item) => (
          item.household_id === params[0]
          && item.provider === params[1]
          && item.item_id === params[2]
        )).map((item) => ({
          id: item.id,
          household_id: item.household_id,
          provider: item.provider,
          item_id: item.item_id,
          access_token: item.access_token,
          institution_name: item.institution_name,
          link_session_id: item.link_session_id,
          transaction_cursor: item.transaction_cursor,
          sync_status: item.sync_status,
        }));

        return { rowCount: rows.length, rows };
      }

      if (normalized === 'select external_account_id, owner_member_id from accounts where household_id = $1 and external_provider = $2 and external_item_id = $3 order by id') {
        const rows = mockState.accounts
          .filter((account) => (
            account.household_id === params[0]
            && account.external_provider === params[1]
            && account.external_item_id === params[2]
          ))
          .map((account) => ({
            external_account_id: account.external_account_id,
            owner_member_id: account.owner_member_id,
          }));

        return { rowCount: rows.length, rows };
      }

      if (normalized === 'select id, slug from household_members where household_id = $1 order by id') {
        const rows = mockState.members
          .filter((member) => member.household_id === params[0])
          .map((member) => ({
            id: member.id,
            slug: member.slug,
          }));

        return { rowCount: rows.length, rows };
      }

      if (normalized === 'select as_of from households where id = $1 limit 1') {
        const household = mockState.household.id === params[0] ? mockState.household : null;
        return {
          rowCount: household ? 1 : 0,
          rows: household ? [{ as_of: household.as_of }] : [],
        };
      }

      throw new Error(`Unsupported mock query: ${String(text).trim().slice(0, 80)}`);
    },
  };
}

export { isMockDatabaseEnabled };
