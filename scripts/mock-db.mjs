import { DATA } from '../src/data.js';
import { normalizeAccountInput, normalizeImportedAccountInput } from './account-input.mjs';
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
  };

  const members = DATA.members.map((member, index) => ({
    id: index + 1,
    household_id: household.id,
    slug: member.slug,
    display_name: member.name,
    age: member.age ?? null,
    role: member.role,
  }));

  const accounts = [];
  let accountSortOrder = 0;
  for (const group of DATA.accounts) {
    for (const item of group.items) {
      accounts.push({
        id: accounts.length + 1,
        household_id: household.id,
        owner_member_id: memberIdBySlug({ members }, item.owner),
        account_group: group.group,
        name: item.name,
        subtitle: item.sub,
        icon: item.icon,
        balance: item.bal,
        sort_order: accountSortOrder += 1,
        external_provider: null,
        external_item_id: null,
        external_account_id: null,
        imported_at: null,
        sync_status: null,
      });
    }
  }

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
    id: index + 1,
    household_id: household.id,
    name: debt.name,
    paid_amount: debt.paid,
    total_amount: debt.total,
    apr: debt.apr ?? null,
    payment_amount: debt.pmt ?? null,
    end_label: debt.end ?? null,
    is_revolving: Boolean(debt.revolving),
  }));

  const kidJars = [];
  const chores = [];
  let choreId = 1;
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
    kidJars,
    chores,
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
      kidJar: nextId(kidJars),
      chore: nextId(chores),
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
  };
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
        age: member.age,
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

  return {
    family: household.name,
    householdMembers: mockState.members.map((member) => ({
      slug: member.slug,
      name: member.display_name,
      age: member.age,
      role: member.role,
    })),
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
        name: goal.name,
        current: asNumber(goal.current_amount),
        target: asNumber(goal.target_amount),
        color: goal.color,
        by: goal.target_label,
        owner: memberSlugById(mockState, goal.owner_member_id),
      })),
    transactions: [...transactionsByDay.values()],
    bills: billsRows.map((bill) => ({
      date: { m: bill.month_label, d: bill.day_of_month },
      name: bill.name,
      sub: bill.subtitle,
      amt: asNumber(bill.amount),
      soon: Boolean(bill.is_soon),
      who: memberSlugById(mockState, bill.member_id),
    })),
    investments: {
      total: holdingsRows.reduce((sum, row) => sum + asNumber(row.value), 0),
      delta: 0,
      deltaPct: 0,
      holdings: holdingsRows.map((holding) => ({
        tk: holding.ticker,
        name: holding.name,
        val: asNumber(holding.value),
        d: asNumber(holding.daily_change_percent),
      })),
    },
    debts: debtsRows.map((debt) => ({
      name: debt.name,
      paid: asNumber(debt.paid_amount),
      total: asNumber(debt.total_amount),
      apr: asNumber(debt.apr),
      pmt: asNumber(debt.payment_amount),
      end: debt.end_label,
      revolving: Boolean(debt.is_revolving),
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

      throw new Error(`Unsupported mock query: ${String(text).trim().slice(0, 80)}`);
    },
  };
}

export { isMockDatabaseEnabled };
