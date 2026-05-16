import { AppStateProvider, useAppState } from './app/AppState.jsx';
import { AppShell } from './layout/AppShell.jsx';
import { OverviewPage } from './pages/OverviewPage.jsx';
import { PlaceholderPage } from './pages/PlaceholderPage.jsx';

function CurrentPage(props) {
  const { activePage } = useAppState();

  if (activePage === 'overview') {
    return <OverviewPage {...props} />;
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
