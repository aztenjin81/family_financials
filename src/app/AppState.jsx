import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DATA } from '../data.js';

const AppStateContext = createContext(null);

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

    fetch('/api/dashboard')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Dashboard API returned ${response.status}`);
        }

        return response.json();
      })
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
    toggleChore: (key, done) => setChores(current => ({ ...current, [key]: done })),
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
