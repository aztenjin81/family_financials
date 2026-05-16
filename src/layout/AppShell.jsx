import { useState } from 'react';
import { Avatar, FAMILY, Icon } from '../components.jsx';
import { NAV_ITEMS } from '../lib/navigation.js';
import { getGreetingParts } from '../lib/greeting.js';
import { useAppState } from '../app/AppState.jsx';

export function AppShell({ children }) {
  const {
    activePage,
    addTransaction,
    dashboardData,
    dashboardSource,
    dismissInsight,
    hidden,
    setActivePage,
    setHidden,
    showInsight,
  } = useAppState();
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [transactionError, setTransactionError] = useState('');
  const [transactionSaving, setTransactionSaving] = useState(false);
  const [transactionForm, setTransactionForm] = useState({
    merchant: '',
    category: 'Groceries',
    amount: '',
    memberSlug: 'john',
    emoji: '🛒',
    isIncome: false,
  });
  const greeting = getGreetingParts();
  const householdMembers = dashboardData.householdMembers || Object.entries(FAMILY).map(([slug, member]) => ({
    slug,
    name: member.name,
    role: slug === 'john' || slug === 'stephanie' ? 'parent' : 'child',
  }));
  const primaryMember = FAMILY.john.name;

  async function submitTransaction(event) {
    event.preventDefault();
    setTransactionError('');
    setTransactionSaving(true);

    try {
      await addTransaction({
        ...transactionForm,
        amount: Number(transactionForm.amount),
        postedLabel: 'Today',
        timeLabel: new Date().toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        }),
      });
      setTransactionForm({
        merchant: '',
        category: 'Groceries',
        amount: '',
        memberSlug: 'john',
        emoji: '🛒',
        isIncome: false,
      });
      setTransactionOpen(false);
    } catch (error) {
      setTransactionError(error.message);
    } finally {
      setTransactionSaving(false);
    }
  }

  function updateTransactionField(field, value) {
    setTransactionForm(current => ({ ...current, [field]: value }));
  }

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
            {householdMembers.map((member) => (
              <Avatar key={member.slug} who={member.slug} />
            ))}
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
          <button className="icon-btn action-btn" type="button" onClick={() => setTransactionOpen(true)}>
            <Icon.Plus size={14} /> Add transaction
          </button>
          <button className="icon-btn action-btn on" type="button">
            Reconcile accounts
          </button>
        </div>
      </section>

      {dashboardSource === 'fixture' && (
        <aside className="fallback-banner" role="status">
          <span className="live-dot" />
          Using demo data until the local database API is available.
        </aside>
      )}

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

      {transactionOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-panel" onSubmit={submitTransaction}>
            <div className="modal-head">
              <div>
                <div className="card-label">Transaction</div>
                <div className="modal-title">Add activity</div>
              </div>
              <button className="icon-btn" type="button" onClick={() => setTransactionOpen(false)} aria-label="Close">
                ×
              </button>
            </div>

            <div className="form-grid">
              <label className="form-field">
                <span>Merchant</span>
                <input
                  required
                  list="merchant-suggestions"
                  value={transactionForm.merchant}
                  onChange={(event) => updateTransactionField('merchant', event.target.value)}
                  placeholder="Store or payee"
                />
                <datalist id="merchant-suggestions">
                  {(dashboardData.merchantSuggestions || []).map((merchant) => (
                    <option key={merchant} value={merchant} />
                  ))}
                </datalist>
              </label>
              <label className="form-field">
                <span>Amount</span>
                <input
                  required
                  min="0.01"
                  step="0.01"
                  type="number"
                  value={transactionForm.amount}
                  onChange={(event) => updateTransactionField('amount', event.target.value)}
                  placeholder="0.00"
                />
              </label>
              <label className="form-field">
                <span>Category</span>
                <select
                  value={transactionForm.category}
                  onChange={(event) => updateTransactionField('category', event.target.value)}
                >
                  <option>Groceries</option>
                  <option>Dining out</option>
                  <option>Kids</option>
                  <option>Gas</option>
                  <option>Utilities</option>
                  <option>Income</option>
                  <option>Fun</option>
                </select>
              </label>
              <label className="form-field">
                <span>Member</span>
                <select
                  value={transactionForm.memberSlug}
                  onChange={(event) => updateTransactionField('memberSlug', event.target.value)}
                >
                  {householdMembers.map((member) => (
                    <option key={member.slug} value={member.slug}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Icon</span>
                <input
                  maxLength="3"
                  value={transactionForm.emoji}
                  onChange={(event) => updateTransactionField('emoji', event.target.value)}
                />
              </label>
              <label className="form-check">
                <input
                  type="checkbox"
                  checked={transactionForm.isIncome}
                  onChange={(event) => updateTransactionField('isIncome', event.target.checked)}
                />
                <span>Income</span>
              </label>
            </div>

            {transactionError && <div className="form-error">{transactionError}</div>}

            <div className="modal-actions">
              <button className="btn-ghost modal-cancel" type="button" onClick={() => setTransactionOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary" type="submit" disabled={transactionSaving}>
                {transactionSaving ? 'Saving...' : 'Save transaction'}
              </button>
            </div>
          </form>
        </div>
      )}

      <footer className="site-footer">
        <span>Hearth · built by John & Stephanie, the long way around</span>
        <span>Last sync 4 min ago · 11 accounts · 6 institutions</span>
      </footer>
    </div>
  );
}
