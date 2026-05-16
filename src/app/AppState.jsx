import { createContext, useContext, useEffect, useMemo, useState } from 'react';
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

export function AppStateProvider({ children }) {
  const [hidden, setHidden] = useState(false);
  const [activePage, setActivePage] = useState('overview');
  const [netWorthRange, setNetWorthRange] = useState('1Y');
  const [chores, setChores] = useState({});
  const [showInsight, setShowInsight] = useState(true);
  const [dashboardData, setDashboardData] = useState(DATA);
  const [dashboardSource, setDashboardSource] = useState('fixture');

  useEffect(() => {
    let active = true;

    requestJson('/api/dashboard')
      .then((data) => {
        if (active) {
          setDashboardData(data);
          setDashboardSource('database');
        }
      })
      .catch(() => {
        if (active) {
          setDashboardData(DATA);
          setDashboardSource('fixture');
        }
      });

    return () => {
      active = false;
    };
  }, []);

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
    addTransaction,
    deleteTransaction,
    showInsight,
    dismissInsight: () => setShowInsight(false),
  }), [activePage, chores, dashboardData, dashboardSource, hidden, netWorthRange, showInsight]);

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
