import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DATA } from '../data.js';
import { requestJson } from '../lib/api.js';

const AppStateContext = createContext(null);

function updateChoreInDashboard(data, choreId, done) {
  return {
    ...data,
    kids: data.kids.map((kid) => ({
      ...kid,
      chores: kid.chores.map((chore) => (
        chore.id === choreId ? { ...chore, done } : chore
      )),
    })),
  };
}

function addChoreInDashboard(data, memberSlug, chore) {
  return {
    ...data,
    kids: data.kids.map((kid) => (
      kid.who === memberSlug
        ? {
            ...kid,
            chores: [
              {
                id: chore.id,
                memberSlug,
                label: chore.label,
                reward: chore.reward,
                done: chore.done,
              },
              ...kid.chores,
            ],
          }
        : kid
    )),
  };
}

function updateChoreInDashboardById(data, choreId, nextChore) {
  const nextMemberSlug = nextChore.memberSlug ?? null;
  const sourceKid = data.kids.find((kid) => kid.chores.some((chore) => chore.id === choreId));
  const sourceKidSlug = sourceKid?.who ?? null;

  if (nextMemberSlug && sourceKidSlug && nextMemberSlug !== sourceKidSlug) {
    return {
      ...data,
      kids: data.kids.map((kid) => {
        if (kid.who === sourceKidSlug) {
          return {
            ...kid,
            chores: kid.chores.filter((chore) => chore.id !== choreId),
          };
        }

        if (kid.who === nextMemberSlug) {
          const existing = sourceKid?.chores.find((chore) => chore.id === choreId);
          if (!existing) {
            return kid;
          }

          return {
            ...kid,
            chores: [
              {
                ...existing,
                label: nextChore.label ?? existing.label,
                reward: nextChore.reward ?? existing.reward,
                done: nextChore.done ?? existing.done,
              },
              ...kid.chores,
            ],
          };
        }

        return kid;
      }),
    };
  }

  return {
    ...data,
    kids: data.kids.map((kid) => ({
      ...kid,
      chores: kid.chores.map((chore) => (
        chore.id === choreId
          ? {
              ...chore,
              label: nextChore.label ?? chore.label,
              reward: nextChore.reward ?? chore.reward,
              done: nextChore.done ?? chore.done,
              memberSlug: nextMemberSlug ?? kid.who,
            }
          : chore
      )),
    })),
  };
}

function deleteChoreFromDashboard(data, choreId) {
  return {
    ...data,
    kids: data.kids.map((kid) => ({
      ...kid,
      chores: kid.chores.filter((chore) => chore.id !== choreId),
    })),
  };
}

function updateSpendingCategoryInDashboard(data, categoryKey, budget) {
  return {
    ...data,
    spending: data.spending.map((category) => (
      category.id === categoryKey
      || category.cat === categoryKey
      || category.name === categoryKey
        ? { ...category, budget }
        : category
    )),
  };
}

export function AppStateProvider({ children }) {
  const [hidden, setHidden] = useState(false);
  const [activePage, setActivePage] = useState('overview');
  const [netWorthRange, setNetWorthRange] = useState('1Y');
  const [chores, setChores] = useState({});
  const [showInsight, setShowInsight] = useState(true);
  const [dashboardData, setDashboardData] = useState(DATA);
  const [dashboardSource, setDashboardSource] = useState('fixture');

  const refreshDashboard = useCallback(async () => {
    try {
      const data = await requestJson('/api/dashboard');
      setDashboardData(data);
      setDashboardSource('database');
      return data;
    } catch {
      setDashboardData(DATA);
      setDashboardSource('fixture');
      return DATA;
    }
  }, []);

  useEffect(() => {
    refreshDashboard();
  }, [refreshDashboard]);

  function toggleChore(key, done, choreId = null) {
    setChores(current => ({ ...current, [key]: done }));

    if (choreId) {
      setDashboardData(current => updateChoreInDashboard(current, choreId, done));
    }

    if (dashboardSource !== 'database' || !choreId) {
      return;
    }

    requestJson(`/api/chores/${choreId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done }),
    })
      .then(({ chore }) => {
        setDashboardData(current => updateChoreInDashboard(current, chore.id, chore.done));
        setChores(current => ({ ...current, [key]: chore.done }));
      })
      .catch(() => {
        setDashboardData(current => updateChoreInDashboard(current, choreId, !done));
        setChores(current => ({ ...current, [key]: !done }));
      });
  }

  async function addChore(chore) {
    const payload = {
      memberSlug: chore.memberSlug,
      label: chore.label,
      reward: chore.reward,
    };

    if (dashboardSource !== 'database') {
      const nextChore = {
        id: Date.now(),
        label: payload.label,
        reward: Number(payload.reward || 0),
        done: false,
      };
      setDashboardData((current) => addChoreInDashboard(current, payload.memberSlug, nextChore));
      return { chore: nextChore };
    }

    const { chore: createdChore } = await requestJson('/api/chores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await requestJson('/api/dashboard');
    setDashboardData(data);
    setDashboardSource('database');
    return { chore: createdChore, dashboard: data };
  }

  async function updateChore(choreId, chore) {
    if (dashboardSource !== 'database') {
      setDashboardData((current) => updateChoreInDashboardById(current, choreId, chore));
      return { chore: { id: choreId, ...chore } };
    }

    const { chore: updatedChore } = await requestJson(`/api/chores/${choreId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chore),
    });

    const data = await requestJson('/api/dashboard');
    setDashboardData(data);
    setDashboardSource('database');
    return { chore: updatedChore, dashboard: data };
  }

  async function deleteChore(choreId) {
    if (dashboardSource !== 'database') {
      setDashboardData((current) => deleteChoreFromDashboard(current, choreId));
      return { chore: { id: choreId } };
    }

    await requestJson(`/api/chores/${choreId}`, {
      method: 'DELETE',
    });

    const data = await requestJson('/api/dashboard');
    setDashboardData(data);
    setDashboardSource('database');
    return { chore: { id: choreId }, dashboard: data };
  }

  async function addTransaction(transaction) {
    await requestJson('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction),
    });

    const data = await requestJson('/api/dashboard');
    setDashboardData(data);
    setDashboardSource('database');
    return data;
  }

  async function addAccount(account) {
    await requestJson('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(account),
    });

    const data = await requestJson('/api/dashboard');
    setDashboardData(data);
    setDashboardSource('database');
    return data;
  }

  async function syncPlaidAccounts(itemId = null) {
    const payload = itemId ? { itemId } : {};

    const result = await requestJson('/api/plaid/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await requestJson('/api/dashboard');
    setDashboardData(data);
    setDashboardSource('database');
    return result;
  }

  async function updateSpendingBudget(category, budget) {
    const nextBudget = Number(budget);

    if (!category || !Number.isFinite(nextBudget)) {
      throw new Error('Budget must be a number');
    }

    if (dashboardSource !== 'database' || category.id == null) {
      setDashboardData((current) => updateSpendingCategoryInDashboard(current, category.id ?? category.cat ?? category.name, nextBudget));
      return {
        spendingCategory: {
          ...category,
          budget: nextBudget,
        },
      };
    }

    await requestJson(`/api/spending-categories/${category.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ budget: nextBudget }),
    });

    const data = await requestJson('/api/dashboard');
    setDashboardData(data);
    setDashboardSource('database');
    return data;
  }

  async function addGoal(goal) {
    await requestJson('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(goal),
    });

    const data = await requestJson('/api/dashboard');
    setDashboardData(data);
    setDashboardSource('database');
    return data;
  }

  async function updateGoal(goalId, goal) {
    await requestJson(`/api/goals/${goalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(goal),
    });

    const data = await requestJson('/api/dashboard');
    setDashboardData(data);
    setDashboardSource('database');
    return data;
  }

  async function updateInvestmentHolding(holdingId, holding) {
    await requestJson(`/api/investments/${holdingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(holding),
    });

    const data = await requestJson('/api/dashboard');
    setDashboardData(data);
    setDashboardSource('database');
    return data;
  }

  async function addDebt(debt) {
    await requestJson('/api/debts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(debt),
    });

    const data = await requestJson('/api/dashboard');
    setDashboardData(data);
    setDashboardSource('database');
    return data;
  }

  async function updateDebt(debtId, debt) {
    await requestJson(`/api/debts/${debtId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(debt),
    });

    const data = await requestJson('/api/dashboard');
    setDashboardData(data);
    setDashboardSource('database');
    return data;
  }

  async function addBill(bill) {
    await requestJson('/api/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bill),
    });

    const data = await requestJson('/api/dashboard');
    setDashboardData(data);
    setDashboardSource('database');
    return data;
  }

  async function updateBill(billId, bill) {
    await requestJson(`/api/bills/${billId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bill),
    });

    const data = await requestJson('/api/dashboard');
    setDashboardData(data);
    setDashboardSource('database');
    return data;
  }

  async function setBillStatus(billId, status) {
    await requestJson(`/api/bills/${billId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    const data = await requestJson('/api/dashboard');
    setDashboardData(data);
    setDashboardSource('database');
    return data;
  }

  async function payWeeklyAllowance() {
    await requestJson('/api/allowance/pay-weekly', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const data = await requestJson('/api/dashboard');
    setDashboardData(data);
    setDashboardSource('database');
    return data;
  }

  async function voidLatestAllowancePayment() {
    await requestJson('/api/allowance/void-latest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const data = await requestJson('/api/dashboard');
    setDashboardData(data);
    setDashboardSource('database');
    return data;
  }

  async function updateAllowanceWeeklyAmount(weeklyAmount) {
    await requestJson('/api/household/allowance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weeklyAmount }),
    });

    const data = await requestJson('/api/dashboard');
    setDashboardData(data);
    setDashboardSource('database');
    return data;
  }

  async function updateAccount(accountId, account) {
    await requestJson(`/api/accounts/${accountId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(account),
    });

    const data = await requestJson('/api/dashboard');
    setDashboardData(data);
    setDashboardSource('database');
    return data;
  }

  async function updateTransaction(transactionId, transaction) {
    await requestJson(`/api/transactions/${transactionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction),
    });

    const data = await requestJson('/api/dashboard');
    setDashboardData(data);
    setDashboardSource('database');
    return data;
  }

  async function deleteTransaction(transactionId) {
    await requestJson(`/api/transactions/${transactionId}`, {
      method: 'DELETE',
    });

    const data = await requestJson('/api/dashboard');
    setDashboardData(data);
    setDashboardSource('database');
    return data;
  }

  const value = useMemo(() => ({
    dashboardData,
    dashboardSource,
    hidden,
    setHidden,
    activePage,
    setActivePage,
    netWorthRange,
    setNetWorthRange,
    chores,
    toggleChore,
    addChore,
    updateChore,
    deleteChore,
    addAccount,
    updateAccount,
    syncPlaidAccounts,
    updateSpendingBudget,
    addTransaction,
    updateTransaction,
    addGoal,
    updateGoal,
    updateInvestmentHolding,
    addDebt,
    updateDebt,
    addBill,
    updateBill,
    setBillStatus,
    payWeeklyAllowance,
    voidLatestAllowancePayment,
    updateAllowanceWeeklyAmount,
    deleteTransaction,
    refreshDashboard,
    showInsight,
    dismissInsight: () => setShowInsight(false),
  }), [activePage, chores, dashboardData, dashboardSource, hidden, netWorthRange, refreshDashboard, showInsight]);

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const state = useContext(AppStateContext);

  if (!state) {
    throw new Error('useAppState must be used within AppStateProvider');
  }

  return state;
}
