import { Avatar, FAMILY, Icon } from '../components.jsx';
import { NAV_ITEMS } from '../lib/navigation.js';
import { getGreetingParts } from '../lib/greeting.js';
import { useAppState } from '../app/AppState.jsx';

export function AppShell({ children }) {
  const {
    activePage,
    dashboardData,
    dismissInsight,
    hidden,
    setActivePage,
    setHidden,
    showInsight,
  } = useAppState();
  const greeting = getGreetingParts();
  const primaryMember = FAMILY.alex.name;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div>
            <div className="brand-mark">Hearth<em>&middot;</em></div>
            <div className="brand-sub">{dashboardData.family}</div>
          </div>
        </div>

        <nav className="topbar-center" aria-label="Primary">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`tab ${item.id === activePage ? 'active' : ''}`}
              onClick={() => setActivePage(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="topbar-right">
          <button className="icon-btn" title="Search" type="button"><Icon.Search /></button>
          <button className="icon-btn notification-btn" title="Notifications" type="button">
            <Icon.Bell />
            <span className="notification-dot" />
          </button>
          <button
            className={`icon-btn ${hidden ? 'on' : ''}`}
            onClick={() => setHidden(value => !value)}
            title={hidden ? 'Show balances' : 'Hide balances'}
            type="button"
          >
            <Icon.Eye open={!hidden} />
          </button>
          <div className="topbar-divider" />
          <div className="member-stack" aria-label="Household members">
            <Avatar who="alex" />
            <Avatar who="sam" />
            <Avatar who="mia" />
            <Avatar who="theo" />
          </div>
        </div>
      </header>

      <section className="greeting">
        <div>
          <div className="card-label">{dashboardData.asOf}</div>
          <h1>{greeting.lead} <em>{primaryMember}</em>{greeting.tail}</h1>
          <div className="muted greeting-subtitle">
            Here's what's happening with the household.
          </div>
        </div>
        <div className="greeting-actions">
          <button className="icon-btn action-btn" type="button">
            <Icon.Plus size={14} /> Add transaction
          </button>
          <button className="icon-btn action-btn on" type="button">
            Reconcile accounts
          </button>
        </div>
      </section>

      {showInsight && (
        <aside className="insight">
          <div className="insight-icon">&#10022;</div>
          <div className="insight-body">
            <strong>Heads up · </strong>{dashboardData.insight.text}
          </div>
          <div className="insight-actions">
            <button className="btn-ghost" onClick={dismissInsight} type="button">Dismiss</button>
            <button className="btn-primary" type="button">Adjust budget</button>
          </div>
        </aside>
      )}

      <main>{children}</main>

      <footer className="site-footer">
        <span>Hearth · built by John & Sam, the long way around</span>
        <span>Last sync 4 min ago · 11 accounts · 6 institutions</span>
      </footer>
    </div>
  );
}
