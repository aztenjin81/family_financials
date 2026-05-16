import { cloneElement, useMemo, useState } from 'react';
import { Avatar, FAMILY, Icon } from '../components.jsx';
import { NAV_ITEMS } from '../lib/navigation.js';
import { getGreetingParts } from '../lib/greeting.js';
import { buildMerchantAutofillMap, getMerchantAutofill } from '../lib/merchant-history.js';
import { parseTransactionDateLabel } from '../lib/transaction-date.js';
import { useAppState } from '../app/AppState.jsx';

export function AppShell({ children }) {
  const {
    activePage,
    addAccount,
    addTransaction,
    dashboardData,
    dashboardSource,
    dismissInsight,
    hidden,
    setActivePage,
    setHidden,
    showInsight,
    updateAccount,
    updateSpendingBudget,
    updateTransaction,
  } = useAppState();
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [transactionError, setTransactionError] = useState('');
  const [transactionSaving, setTransactionSaving] = useState(false);
  const [transactionMode, setTransactionMode] = useState('add');
  const [transactionId, setTransactionId] = useState(null);
  const [transactionForm, setTransactionForm] = useState({
    merchant: '',
    category: 'Groceries',
    amount: '',
    memberSlug: 'john',
    emoji: '🛒',
    isIncome: false,
    postedDate: dashboardData.asOfDate || new Date().toISOString().slice(0, 10),
    postedLabel: 'Today',
    timeLabel: '',
  });
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountMode, setAccountMode] = useState('add');
  const [accountId, setAccountId] = useState(null);
  const [accountForm, setAccountForm] = useState({
    accountGroup: 'Cash',
    name: '',
    subtitle: '',
    icon: 'Bank',
    balance: '',
    ownerSlug: 'john',
  });
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetError, setBudgetError] = useState('');
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetForm, setBudgetForm] = useState({
    id: null,
    name: '',
    spent: 0,
    budget: '',
    color: '',
  });
  const greeting = getGreetingParts();
  const householdMembers = dashboardData.householdMembers || Object.entries(FAMILY).map(([slug, member]) => ({
    slug,
    name: member.name,
    role: slug === 'john' || slug === 'stephanie' ? 'parent' : 'child',
  }));
  const primaryMember = FAMILY.john.name;
  const merchantAutofillMap = useMemo(
    () => buildMerchantAutofillMap(dashboardData.transactions || []),
    [dashboardData.transactions],
  );
  const accountGroupOptions = useMemo(
    () => [...new Set((dashboardData.accounts || []).map((group) => group.group))],
    [dashboardData.accounts],
  );
  const spendingOptions = dashboardData.spending || [];

  function createTransactionForm(transaction = null) {
    const timeLabel = new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    const fallbackDate = dashboardData.asOfDate || new Date().toISOString().slice(0, 10);

    if (transaction) {
      const postedDate = transaction.postedDate
        || parseTransactionDateLabel(transaction.postedLabel, fallbackDate)
        || fallbackDate;

      return {
        merchant: transaction.merch,
        category: transaction.cat,
        amount: String(Math.abs(transaction.amt)),
        memberSlug: transaction.who,
        emoji: transaction.emoji,
        isIncome: Boolean(transaction.income),
        postedDate,
        postedLabel: transaction.postedLabel || 'Today',
        timeLabel: transaction.time || timeLabel,
      };
    }

    return {
      merchant: '',
      category: 'Groceries',
      amount: '',
      memberSlug: 'john',
      emoji: '🛒',
      isIncome: false,
      postedDate: fallbackDate,
      postedLabel: 'Today',
      timeLabel,
    };
  }

  function openTransactionModal(transaction = null) {
    setTransactionMode(transaction ? 'edit' : 'add');
    setTransactionId(transaction ? transaction.id : null);
    setTransactionForm(createTransactionForm(transaction));
    setTransactionError('');
    setTransactionOpen(true);
  }

  function closeTransactionModal() {
    setTransactionOpen(false);
    setTransactionMode('add');
    setTransactionId(null);
    setTransactionForm(createTransactionForm());
    setTransactionError('');
  }

  async function submitTransaction(event) {
    event.preventDefault();
    setTransactionError('');
    setTransactionSaving(true);

    try {
      const transactionPayload = {
        ...transactionForm,
        amount: Number(transactionForm.amount),
        postedDate: transactionForm.postedDate || dashboardData.asOfDate || new Date().toISOString().slice(0, 10),
      };

      if (transactionMode === 'edit' && transactionId != null) {
        await updateTransaction(transactionId, transactionPayload);
      } else {
        await addTransaction(transactionPayload);
      }

      closeTransactionModal();
    } catch (error) {
      setTransactionError(error.message);
    } finally {
      setTransactionSaving(false);
    }
  }

  function updateTransactionField(field, value) {
    setTransactionForm((current) => {
      const next = { ...current, [field]: value };

      if (field !== 'merchant') {
        return next;
      }

      const autofill = getMerchantAutofill(merchantAutofillMap, value);

      if (!autofill) {
        return next;
      }

      return {
        ...next,
        category: autofill.category || current.category,
        memberSlug: autofill.memberSlug || current.memberSlug,
        emoji: autofill.emoji || current.emoji,
      };
    });
  }

  function createAccountForm(account = null) {
    if (account) {
      return {
        accountGroup: account.group || 'Cash',
        name: account.name || '',
        subtitle: account.sub || '',
        icon: account.icon || 'Bank',
        balance: String(account.bal ?? 0),
        ownerSlug: account.owner || 'john',
      };
    }

    return {
      accountGroup: accountGroupOptions[0] || 'Cash',
      name: '',
      subtitle: '',
      icon: 'Bank',
      balance: '',
      ownerSlug: 'john',
    };
  }

  function openAccountModal(account = null) {
    setAccountMode(account ? 'edit' : 'add');
    setAccountId(account ? account.id : null);
    setAccountForm(createAccountForm(account));
    setAccountError('');
    setAccountOpen(true);
  }

  function closeAccountModal() {
    setAccountOpen(false);
    setAccountMode('add');
    setAccountId(null);
    setAccountForm(createAccountForm());
    setAccountError('');
  }

  async function submitAccount(event) {
    event.preventDefault();
    setAccountError('');
    setAccountSaving(true);

    try {
      const payload = {
        ...accountForm,
        balance: Number(accountForm.balance),
      };

      if (accountMode === 'edit' && accountId != null) {
        await updateAccount(accountId, payload);
      } else {
        await addAccount(payload);
      }

      closeAccountModal();
    } catch (error) {
      setAccountError(error.message);
    } finally {
      setAccountSaving(false);
    }
  }

  function updateAccountField(field, value) {
    setAccountForm((current) => ({ ...current, [field]: value }));
  }

  function createBudgetForm(category = null) {
    const selectedCategory = category
      || spendingOptions.find((item) => item.spent > item.budget)
      || spendingOptions[0]
      || null;

    if (!selectedCategory) {
      return {
        id: null,
        name: '',
        spent: 0,
        budget: '',
        color: '',
      };
    }

    return {
      id: selectedCategory.id ?? null,
      name: selectedCategory.cat,
      spent: selectedCategory.spent,
      budget: String(selectedCategory.budget ?? ''),
      color: selectedCategory.color || '',
    };
  }

  function openBudgetModal(category = null) {
    setBudgetForm(createBudgetForm(category));
    setBudgetError('');
    setBudgetOpen(true);
  }

  function closeBudgetModal() {
    setBudgetOpen(false);
    setBudgetError('');
    setBudgetSaving(false);
    setBudgetForm(createBudgetForm());
  }

  async function submitBudget(event) {
    event.preventDefault();
    setBudgetError('');
    setBudgetSaving(true);

    try {
      const currentCategory = spendingOptions.find((item) => item.id === budgetForm.id)
        || spendingOptions.find((item) => item.cat === budgetForm.name)
        || null;

      await updateSpendingBudget(currentCategory || budgetForm, Number(budgetForm.budget));
      closeBudgetModal();
    } catch (error) {
      setBudgetError(error.message);
    } finally {
      setBudgetSaving(false);
    }
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
          <button className="icon-btn action-btn" type="button" onClick={() => openTransactionModal()}>
            <Icon.Plus size={14} /> Add transaction
          </button>
          <button className="icon-btn action-btn" type="button" onClick={() => openAccountModal()}>
            <Icon.Plus size={14} /> Add account
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
            <button className="btn-primary" onClick={() => openBudgetModal()} type="button">Adjust budget</button>
          </div>
        </aside>
      )}

      <main>{cloneElement(children, {
        onAddAccount: openAccountModal,
        onEditAccount: openAccountModal,
        onEditTransaction: openTransactionModal,
        onAdjustBudget: openBudgetModal,
      })}</main>

      {transactionOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-panel" onSubmit={submitTransaction}>
            <div className="modal-head">
              <div>
                <div className="card-label">Transaction</div>
                <div className="modal-title">{transactionMode === 'edit' ? 'Edit activity' : 'Add activity'}</div>
              </div>
              <button className="icon-btn" type="button" onClick={closeTransactionModal} aria-label="Close">
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
                <span>Date</span>
                <input
                  required
                  type="date"
                  value={transactionForm.postedDate}
                  onChange={(event) => updateTransactionField('postedDate', event.target.value)}
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
              <button className="btn-ghost modal-cancel" type="button" onClick={closeTransactionModal}>
                Cancel
              </button>
              <button className="btn-primary" type="submit" disabled={transactionSaving}>
                {transactionSaving ? 'Saving...' : transactionMode === 'edit' ? 'Update transaction' : 'Save transaction'}
              </button>
            </div>
          </form>
        </div>
      )}

      {budgetOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-panel" onSubmit={submitBudget}>
            <div className="modal-head">
              <div>
                <div className="card-label">Budget</div>
                <div className="modal-title">Adjust budget</div>
              </div>
              <button className="icon-btn" type="button" onClick={closeBudgetModal} aria-label="Close">
                ×
              </button>
            </div>

            <div className="budget-summary">
              <div>
                <div className="muted tiny">Category</div>
                <div className="budget-name">{budgetForm.name || 'Unassigned'}</div>
              </div>
              <div>
                <div className="muted tiny">Spent</div>
                <div className="budget-spent">{budgetForm.spent.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</div>
              </div>
            </div>

            <label className="form-field">
              <span>Monthly budget</span>
              <input
                required
                min="0"
                step="0.01"
                type="number"
                value={budgetForm.budget}
                onChange={(event) => setBudgetForm((current) => ({ ...current, budget: event.target.value }))}
                placeholder="0.00"
              />
            </label>

            {budgetError && <div className="form-error">{budgetError}</div>}

            <div className="modal-actions">
              <button className="btn-ghost modal-cancel" type="button" onClick={closeBudgetModal}>
                Cancel
              </button>
              <button className="btn-primary" type="submit" disabled={budgetSaving}>
                {budgetSaving ? 'Saving...' : 'Save budget'}
              </button>
            </div>
          </form>
        </div>
      )}

      {accountOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-panel" onSubmit={submitAccount}>
            <div className="modal-head">
              <div>
                <div className="card-label">Account</div>
                <div className="modal-title">{accountMode === 'edit' ? 'Edit account' : 'Add account'}</div>
              </div>
              <button className="icon-btn" type="button" onClick={closeAccountModal} aria-label="Close">
                ×
              </button>
            </div>

            <div className="form-grid">
              <label className="form-field">
                <span>Group</span>
                <input
                  required
                  list="account-groups"
                  value={accountForm.accountGroup}
                  onChange={(event) => updateAccountField('accountGroup', event.target.value)}
                  placeholder="Cash"
                />
                <datalist id="account-groups">
                  {accountGroupOptions.map((group) => (
                    <option key={group} value={group} />
                  ))}
                </datalist>
              </label>
              <label className="form-field">
                <span>Name</span>
                <input
                  required
                  value={accountForm.name}
                  onChange={(event) => updateAccountField('name', event.target.value)}
                  placeholder="Account name"
                />
              </label>
              <label className="form-field">
                <span>Subtitle</span>
                <input
                  value={accountForm.subtitle}
                  onChange={(event) => updateAccountField('subtitle', event.target.value)}
                  placeholder="Optional note"
                />
              </label>
              <label className="form-field">
                <span>Balance</span>
                <input
                  required
                  step="0.01"
                  type="number"
                  value={accountForm.balance}
                  onChange={(event) => updateAccountField('balance', event.target.value)}
                  placeholder="0.00"
                />
              </label>
              <label className="form-field">
                <span>Owner</span>
                <select
                  value={accountForm.ownerSlug}
                  onChange={(event) => updateAccountField('ownerSlug', event.target.value)}
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
                <select
                  value={accountForm.icon}
                  onChange={(event) => updateAccountField('icon', event.target.value)}
                >
                  <option value="Bank">Bank</option>
                  <option value="Card">Card</option>
                  <option value="Vault">Vault</option>
                  <option value="Home">Home</option>
                  <option value="Stock">Stock</option>
                  <option value="Car">Car</option>
                </select>
              </label>
            </div>

            {accountError && <div className="form-error">{accountError}</div>}

            <div className="modal-actions">
              <button className="btn-ghost modal-cancel" type="button" onClick={closeAccountModal}>
                Cancel
              </button>
              <button className="btn-primary" type="submit" disabled={accountSaving}>
                {accountSaving ? 'Saving...' : accountMode === 'edit' ? 'Update account' : 'Save account'}
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
