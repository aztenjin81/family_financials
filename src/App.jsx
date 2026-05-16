import { AppStateProvider, useAppState } from './app/AppState.jsx';
import { AppShell } from './layout/AppShell.jsx';
import { OverviewPage } from './pages/OverviewPage.jsx';
import { PlaceholderPage } from './pages/PlaceholderPage.jsx';

function CurrentPage() {
  const { activePage } = useAppState();

  if (activePage === 'overview') {
    return <OverviewPage />;
  }

  return <PlaceholderPage page={activePage} />;
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
