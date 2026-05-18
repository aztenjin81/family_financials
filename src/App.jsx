import { AppStateProvider, useAppState } from './app/AppState.jsx';
import { AppShell } from './layout/AppShell.jsx';
import { AccountsPage } from './pages/AccountsPage.jsx';
import { GoalsPage } from './pages/GoalsPage.jsx';
import { KidsPage } from './pages/KidsPage.jsx';
import { OverviewPage } from './pages/OverviewPage.jsx';
import { TransactionsPage } from './pages/TransactionsPage.jsx';
import { PlaceholderPage } from './pages/PlaceholderPage.jsx';

function CurrentPage(props) {
  const { activePage } = useAppState();

  if (activePage === 'overview') {
    return <OverviewPage {...props} />;
  }

  if (activePage === 'transactions') {
    return <TransactionsPage {...props} />;
  }

  if (activePage === 'accounts') {
    return <AccountsPage {...props} />;
  }

  if (activePage === 'goals') {
    return <GoalsPage {...props} />;
  }

  if (activePage === 'kids') {
    return <KidsPage {...props} />;
  }

  return <PlaceholderPage page={activePage} {...props} />;
}

function App() {
  return (
    <AppStateProvider>
      <AppShell>
        <CurrentPage />
      </AppShell>
    </AppStateProvider>
  );
}

export default App;
