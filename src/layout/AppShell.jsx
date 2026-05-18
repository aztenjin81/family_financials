import { cloneElement, useMemo, useState } from 'react';
import { Avatar, FAMILY, Icon } from '../components.jsx';
import {
  countDashboardAccounts,
  countLinkedPlaidItems,
  formatAccountCount,
  formatAccountSyncAge,
  formatPlaidItemCount,
} from '../lib/accounts.js';
import { NAV_ITEMS } from '../lib/navigation.js';
import { getGreetingParts } from '../lib/greeting.js';
import { buildMerchantAutofillMap, getMerchantAutofill } from '../lib/merchant-history.js';
import { buildTransactionCategoryOptions } from '../lib/transactions.js';
import { parseTransactionDateLabel } from '../lib/transaction-date.js';
import { useAppState } from '../app/AppState.jsx';

export function AppShell({ children }) {
  const {
    activePage,
    addAccount,
    addChore,
    addGoal,
    addBill,
    addDebt,
    addTransaction,
    dashboardData,
    dashboardSource,
    dismissInsight,
    hidden,
    setActivePage,
    setHidden,
    setBillStatus,
    showInsight,
    updateAccount,
    updateChore,
    updateBill,
    updateDebt,
    updateInvestmentHolding,
    updateGoal,
    updateSpendingBudget,
    updateTransaction,
    deleteChore,
    syncPlaidAccounts,
    payWeeklyAllowance: issueWeeklyAllowance,
    voidLatestAllowancePayment: issueVoidLatestAllowancePayment,
    updateAllowanceWeeklyAmount: issueWeeklyAllowanceAmount,
  } = useAppState();
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [transactionError, setTransactionError] = useState('');
  const [transactionSaving, setTransactionSaving] = useState(false);
  const [transactionMode, setTransactionMode] = useState('add');
  const [transactionId, setTransactionId] = useState(null);
  const [transactionForm, setTransactionForm] = useState(() => ({
    merchant: '',
    category: buildTransactionCategoryOptions(dashboardData)[0] || '',
    amount: '',
    memberSlug: 'john',
    emoji: '🛒',
    isIncome: false,
    postedDate: dashboardData.asOfDate || new Date().toISOString().slice(0, 10),
    postedLabel: 'Today',
    timeLabel: '',
  }));
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
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalError, setGoalError] = useState('');
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalMode, setGoalMode] = useState('add');
  const [goalId, setGoalId] = useState(null);
  const [goalForm, setGoalForm] = useState({
    ownerSlug: 'john',
    name: '',
    currentAmount: '0',
    targetAmount: '',
    color: '#1F7A4D',
    targetLabel: '',
  });
  const [billOpen, setBillOpen] = useState(false);
  const [billError, setBillError] = useState('');
  const [billSaving, setBillSaving] = useState(false);
  const [billMode, setBillMode] = useState('add');
  const [billId, setBillId] = useState(null);
  const [billForm, setBillForm] = useState({
    memberSlug: 'john',
    monthLabel: 'May',
    dayOfMonth: '1',
    name: '',
    subtitle: '',
    amount: '',
    isSoon: false,
    status: 'upcoming',
  });
  const [investmentOpen, setInvestmentOpen] = useState(false);
  const [investmentError, setInvestmentError] = useState('');
  const [investmentSaving, setInvestmentSaving] = useState(false);
  const [investmentId, setInvestmentId] = useState(null);
  const [investmentForm, setInvestmentForm] = useState({
    ticker: '',
    name: '',
    value: '',
    dailyChangePercent: '',
  });
  const [debtOpen, setDebtOpen] = useState(false);
  const [debtError, setDebtError] = useState('');
  const [debtSaving, setDebtSaving] = useState(false);
  const [debtMode, setDebtMode] = useState('add');
  const [debtId, setDebtId] = useState(null);
  const [debtForm, setDebtForm] = useState({
    name: '',
    paid: '',
    total: '',
    apr: '',
    pmt: '',
    end: '',
    revolving: false,
  });
  const [allowanceSaving, setAllowanceSaving] = useState(false);
  const [allowanceVoiding, setAllowanceVoiding] = useState(false);
  const [allowanceError, setAllowanceError] = useState('');
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
  const transactionCategoryOptions = useMemo(
    () => buildTransactionCategoryOptions(dashboardData),
    [dashboardData.spending, dashboardData.transactions],
  );
  const accountGroupOptions = useMemo(
    () => [...new Set((dashboardData.accounts || []).map((group) => group.group))],
    [dashboardData.accounts],
  );
  const goalColorOptions = ['#1F7A4D', '#C94A2C', '#D9A322', '#2B5FB8', '#6B3A85'];
  const spendingOptions = dashboardData.spending || [];
  const accountCount = countDashboardAccounts(dashboardData);
  const plaidItemCount = countLinkedPlaidItems(dashboardData);
  const accountSyncAge = formatAccountSyncAge(dashboardData);

  function createTransactionForm(transaction = null) {
    const timeLabel = new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    const fallbackDate = dashboardData.asOfDate || new Date().toISOString().slice(0, 10);
    const defaultCategory = transactionCategoryOptions[0] || '';

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
      category: defaultCategory,
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

  function createGoalForm(goal = null) {
    if (goal) {
      return {
        ownerSlug: goal.owner || 'john',
        name: goal.name || '',
        currentAmount: String(goal.current ?? 0),
        targetAmount: String(goal.target ?? ''),
        color: goal.color || goalColorOptions[0],
        targetLabel: goal.by || '',
      };
    }

    return {
      ownerSlug: 'john',
      name: '',
      currentAmount: '0',
      targetAmount: '',
      color: goalColorOptions[0],
      targetLabel: '',
    };
  }

  function openGoalModal(goal = null) {
    setGoalMode(goal ? 'edit' : 'add');
    setGoalId(goal ? goal.id : null);
    setGoalForm(createGoalForm(goal));
    setGoalError('');
    setGoalOpen(true);
  }

  function closeGoalModal() {
    setGoalOpen(false);
    setGoalMode('add');
    setGoalId(null);
    setGoalForm(createGoalForm());
    setGoalError('');
    setGoalSaving(false);
  }

  async function submitGoal(event) {
    event.preventDefault();
    setGoalError('');
    setGoalSaving(true);

    try {
      const payload = {
        ownerSlug: goalForm.ownerSlug,
        name: goalForm.name,
        currentAmount: Number(goalForm.currentAmount),
        targetAmount: Number(goalForm.targetAmount),
        color: goalForm.color,
        targetLabel: goalForm.targetLabel,
      };

      if (goalMode === 'edit' && goalId != null) {
        await updateGoal(goalId, payload);
      } else {
        await addGoal(payload);
      }

      closeGoalModal();
    } catch (error) {
      setGoalError(error.message);
    } finally {
      setGoalSaving(false);
    }
  }

  function updateGoalField(field, value) {
    setGoalForm((current) => ({ ...current, [field]: value }));
  }

  function createInvestmentForm(holding = null) {
    if (holding) {
      return {
        ticker: holding.tk || '',
        name: holding.name || '',
        value: String(holding.val ?? ''),
        dailyChangePercent: String(holding.d ?? ''),
      };
    }

    const firstHolding = dashboardData.investments?.holdings?.[0] || null;

    return {
      ticker: firstHolding?.tk || '',
      name: firstHolding?.name || '',
      value: String(firstHolding?.val ?? ''),
      dailyChangePercent: String(firstHolding?.d ?? ''),
    };
  }

  function openInvestmentModal(holding = null) {
    setInvestmentId(holding ? holding.id : null);
    setInvestmentForm(createInvestmentForm(holding));
    setInvestmentError('');
    setInvestmentOpen(true);
  }

  function closeInvestmentModal() {
    setInvestmentOpen(false);
    setInvestmentId(null);
    setInvestmentForm(createInvestmentForm());
    setInvestmentError('');
    setInvestmentSaving(false);
  }

  async function submitInvestment(event) {
    event.preventDefault();
    setInvestmentError('');
    setInvestmentSaving(true);

    try {
      const payload = {
        ...investmentForm,
        value: Number(investmentForm.value),
        dailyChangePercent: Number(investmentForm.dailyChangePercent),
      };

      if (investmentId != null) {
        await updateInvestmentHolding(investmentId, payload);
      }

      closeInvestmentModal();
    } catch (error) {
      setInvestmentError(error.message);
    } finally {
      setInvestmentSaving(false);
    }
  }

  function updateInvestmentField(field, value) {
    setInvestmentForm((current) => ({ ...current, [field]: value }));
  }

  function createDebtForm(debt = null) {
    if (debt) {
      return {
        name: debt.name || '',
        paid: String(debt.paid ?? ''),
        total: String(debt.total ?? ''),
        apr: String(debt.apr ?? ''),
        pmt: String(debt.pmt ?? ''),
        end: debt.end || '',
        revolving: Boolean(debt.revolving),
      };
    }

    return {
      name: '',
      paid: '',
      total: '',
      apr: '',
      pmt: '',
      end: '',
      revolving: false,
    };
  }

  function openDebtModal(debt = null) {
    setDebtMode(debt ? 'edit' : 'add');
    setDebtId(debt ? debt.id : null);
    setDebtForm(createDebtForm(debt));
    setDebtError('');
    setDebtOpen(true);
  }

  function closeDebtModal() {
    setDebtOpen(false);
    setDebtMode('add');
    setDebtId(null);
    setDebtForm(createDebtForm());
    setDebtError('');
    setDebtSaving(false);
  }

  async function submitDebt(event) {
    event.preventDefault();
    setDebtError('');
    setDebtSaving(true);

    try {
      const payload = {
        ...debtForm,
        paid: Number(debtForm.paid),
        total: Number(debtForm.total),
        apr: Number(debtForm.apr),
        pmt: Number(debtForm.pmt),
      };

      if (debtMode === 'edit' && debtId != null) {
        await updateDebt(debtId, payload);
      } else {
        await addDebt(payload);
      }

      closeDebtModal();
    } catch (error) {
      setDebtError(error.message);
    } finally {
      setDebtSaving(false);
    }
  }

  function updateDebtField(field, value) {
    setDebtForm((current) => ({ ...current, [field]: value }));
  }

  function createBillForm(bill = null) {
    if (bill) {
      return {
        memberSlug: bill.who || 'john',
        monthLabel: bill.date?.m || 'May',
        dayOfMonth: String(bill.date?.d || ''),
        name: bill.name || '',
        subtitle: bill.sub || '',
        amount: String(bill.amt ?? ''),
        isSoon: Boolean(bill.soon),
        status: bill.status || (bill.soon ? 'upcoming' : 'upcoming'),
      };
    }

    return {
      memberSlug: householdMembers[0]?.slug || 'john',
      monthLabel: dashboardData.asOfDate
        ? new Date(dashboardData.asOfDate).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
        : 'May',
      dayOfMonth: '',
      name: '',
      subtitle: '',
      amount: '',
      isSoon: false,
      status: 'upcoming',
    };
  }

  function openBillModal(bill = null) {
    setBillMode(bill ? 'edit' : 'add');
    setBillId(bill ? bill.id : null);
    setBillForm(createBillForm(bill));
    setBillError('');
    setBillOpen(true);
  }

  function closeBillModal() {
    setBillOpen(false);
    setBillMode('add');
    setBillId(null);
    setBillForm(createBillForm());
    setBillError('');
    setBillSaving(false);
  }

  async function submitBill(event) {
    event.preventDefault();
    setBillError('');
    setBillSaving(true);

    try {
      const payload = {
        ...billForm,
        dayOfMonth: Number(billForm.dayOfMonth),
        amount: Number(billForm.amount),
      };

      if (billMode === 'edit' && billId != null) {
        await updateBill(billId, payload);
      } else {
        await addBill(payload);
      }

      closeBillModal();
    } catch (error) {
      setBillError(error.message);
    } finally {
      setBillSaving(false);
    }
  }

  function updateBillField(field, value) {
    setBillForm((current) => ({ ...current, [field]: value }));
  }

  async function changeBillStatus(bill, status) {
    try {
      await setBillStatus(bill.id, status);
    } catch (error) {
      window.alert(error.message);
    }
  }

  async function handlePayWeeklyAllowance() {
    setAllowanceError('');
    setAllowanceSaving(true);

    try {
      await issueWeeklyAllowance();
    } catch (error) {
      setAllowanceError(error.message);
      window.alert(error.message);
    } finally {
      setAllowanceSaving(false);
    }
  }

  async function handleVoidLatestAllowance() {
    setAllowanceError('');
    setAllowanceVoiding(true);

    try {
      await issueVoidLatestAllowancePayment();
    } catch (error) {
      setAllowanceError(error.message);
      window.alert(error.message);
    } finally {
      setAllowanceVoiding(false);
    }
  }

  async function handleUpdateWeeklyAllowance(weeklyAmount) {
    setAllowanceError('');

    try {
      await issueWeeklyAllowanceAmount(weeklyAmount);
    } catch (error) {
      setAllowanceError(error.message);
      window.alert(error.message);
      throw error;
    }
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
        onAddGoal: openGoalModal,
        onAddBill: openBillModal,
        onAddDebt: openDebtModal,
        onAddChore: addChore,
        onSyncPlaidAccounts: syncPlaidAccounts,
        onUpdateChore: updateChore,
        onDeleteChore: deleteChore,
        onEditAccount: openAccountModal,
        onEditGoal: openGoalModal,
        onEditBill: openBillModal,
        onEditInvestment: openInvestmentModal,
        onEditDebt: openDebtModal,
        onSetBillStatus: changeBillStatus,
        onAddTransaction: openTransactionModal,
        onEditTransaction: openTransactionModal,
        onAdjustBudget: openBudgetModal,
        onSyncPlaidAccounts: syncPlaidAccounts,
        onOpenTransactions: () => setActivePage('transactions'),
        onPayWeeklyAllowance: handlePayWeeklyAllowance,
        onVoidLatestAllowance: handleVoidLatestAllowance,
        onUpdateWeeklyAllowance: handleUpdateWeeklyAllowance,
        onUpdateChore: updateChore,
        onDeleteChore: deleteChore,
        allowanceSaving,
        allowanceVoiding,
        allowanceError,
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
                <input
                  required
                  list="transaction-categories"
                  value={transactionForm.category}
                  onChange={(event) => updateTransactionField('category', event.target.value)}
                  placeholder="Category"
                />
                <datalist id="transaction-categories">
                  {transactionCategoryOptions.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
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

      {billOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-panel" onSubmit={submitBill}>
            <div className="modal-head">
              <div>
                <div className="card-label">Bill</div>
                <div className="modal-title">{billMode === 'edit' ? 'Edit bill' : 'Add bill'}</div>
              </div>
              <button className="icon-btn" type="button" onClick={closeBillModal} aria-label="Close">
                ×
              </button>
            </div>

            <div className="form-grid">
              <label className="form-field">
                <span>Member</span>
                <select
                  value={billForm.memberSlug}
                  onChange={(event) => updateBillField('memberSlug', event.target.value)}
                >
                  {householdMembers.map((member) => (
                    <option key={member.slug} value={member.slug}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Month</span>
                <input
                  required
                  value={billForm.monthLabel}
                  onChange={(event) => updateBillField('monthLabel', event.target.value)}
                  placeholder="May"
                />
              </label>
              <label className="form-field">
                <span>Day</span>
                <input
                  required
                  min="1"
                  step="1"
                  type="number"
                  value={billForm.dayOfMonth}
                  onChange={(event) => updateBillField('dayOfMonth', event.target.value)}
                  placeholder="14"
                />
              </label>
              <label className="form-field">
                <span>Name</span>
                <input
                  required
                  value={billForm.name}
                  onChange={(event) => updateBillField('name', event.target.value)}
                  placeholder="Bill name"
                />
              </label>
              <label className="form-field">
                <span>Subtitle</span>
                <input
                  value={billForm.subtitle}
                  onChange={(event) => updateBillField('subtitle', event.target.value)}
                  placeholder="Optional note"
                />
              </label>
              <label className="form-field">
                <span>Amount</span>
                <input
                  required
                  min="0"
                  step="0.01"
                  type="number"
                  value={billForm.amount}
                  onChange={(event) => updateBillField('amount', event.target.value)}
                  placeholder="0.00"
                />
              </label>
              <label className="form-field">
                <span>Status</span>
                <select
                  value={billForm.status}
                  onChange={(event) => updateBillField('status', event.target.value)}
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="paid">Paid</option>
                  <option value="snoozed">Snoozed</option>
                </select>
              </label>
              <label className="form-check">
                <input
                  type="checkbox"
                  checked={billForm.isSoon}
                  onChange={(event) => updateBillField('isSoon', event.target.checked)}
                />
                <span>Due soon</span>
              </label>
            </div>

            {billError && <div className="form-error">{billError}</div>}

            <div className="modal-actions">
              <button className="btn-ghost modal-cancel" type="button" onClick={closeBillModal}>
                Cancel
              </button>
              <button className="btn-primary" type="submit" disabled={billSaving}>
                {billSaving ? 'Saving...' : billMode === 'edit' ? 'Update bill' : 'Save bill'}
              </button>
            </div>
          </form>
        </div>
      )}

      {investmentOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-panel" onSubmit={submitInvestment}>
            <div className="modal-head">
              <div>
                <div className="card-label">Investment</div>
                <div className="modal-title">Edit holding</div>
              </div>
              <button className="icon-btn" type="button" onClick={closeInvestmentModal} aria-label="Close">
                ×
              </button>
            </div>

            <div className="form-grid">
              <label className="form-field">
                <span>Ticker</span>
                <input
                  required
                  value={investmentForm.ticker}
                  onChange={(event) => updateInvestmentField('ticker', event.target.value)}
                  placeholder="VTI"
                />
              </label>
              <label className="form-field">
                <span>Name</span>
                <input
                  required
                  value={investmentForm.name}
                  onChange={(event) => updateInvestmentField('name', event.target.value)}
                  placeholder="Holding name"
                />
              </label>
              <label className="form-field">
                <span>Value</span>
                <input
                  required
                  min="0"
                  step="0.01"
                  type="number"
                  value={investmentForm.value}
                  onChange={(event) => updateInvestmentField('value', event.target.value)}
                  placeholder="0.00"
                />
              </label>
              <label className="form-field">
                <span>Daily change %</span>
                <input
                  required
                  step="0.01"
                  type="number"
                  value={investmentForm.dailyChangePercent}
                  onChange={(event) => updateInvestmentField('dailyChangePercent', event.target.value)}
                  placeholder="0.00"
                />
              </label>
            </div>

            {investmentError && <div className="form-error">{investmentError}</div>}

            <div className="modal-actions">
              <button className="btn-ghost modal-cancel" type="button" onClick={closeInvestmentModal}>
                Cancel
              </button>
              <button className="btn-primary" type="submit" disabled={investmentSaving}>
                {investmentSaving ? 'Saving...' : 'Update holding'}
              </button>
            </div>
          </form>
        </div>
      )}

      {debtOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-panel" onSubmit={submitDebt}>
            <div className="modal-head">
              <div>
                <div className="card-label">Debt</div>
                <div className="modal-title">{debtMode === 'edit' ? 'Edit debt' : 'Add debt'}</div>
              </div>
              <button className="icon-btn" type="button" onClick={closeDebtModal} aria-label="Close">
                ×
              </button>
            </div>

            <div className="form-grid">
              <label className="form-field">
                <span>Name</span>
                <input
                  required
                  value={debtForm.name}
                  onChange={(event) => updateDebtField('name', event.target.value)}
                  placeholder="Debt name"
                />
              </label>
              <label className="form-field">
                <span>Paid</span>
                <input
                  required
                  min="0"
                  step="0.01"
                  type="number"
                  value={debtForm.paid}
                  onChange={(event) => updateDebtField('paid', event.target.value)}
                  placeholder="0.00"
                />
              </label>
              <label className="form-field">
                <span>Total</span>
                <input
                  required
                  min="0"
                  step="0.01"
                  type="number"
                  value={debtForm.total}
                  onChange={(event) => updateDebtField('total', event.target.value)}
                  placeholder="0.00"
                />
              </label>
              <label className="form-field">
                <span>APR</span>
                <input
                  required
                  min="0"
                  step="0.01"
                  type="number"
                  value={debtForm.apr}
                  onChange={(event) => updateDebtField('apr', event.target.value)}
                  placeholder="0.00"
                />
              </label>
              <label className="form-field">
                <span>Monthly payment</span>
                <input
                  required
                  min="0"
                  step="0.01"
                  type="number"
                  value={debtForm.pmt}
                  onChange={(event) => updateDebtField('pmt', event.target.value)}
                  placeholder="0.00"
                />
              </label>
              <label className="form-field">
                <span>End label</span>
                <input
                  value={debtForm.end}
                  onChange={(event) => updateDebtField('end', event.target.value)}
                  placeholder="Aug 2052"
                />
              </label>
              <label className="form-check">
                <input
                  type="checkbox"
                  checked={debtForm.revolving}
                  onChange={(event) => updateDebtField('revolving', event.target.checked)}
                />
                <span>Revolving debt</span>
              </label>
            </div>

            {debtError && <div className="form-error">{debtError}</div>}

            <div className="modal-actions">
              <button className="btn-ghost modal-cancel" type="button" onClick={closeDebtModal}>
                Cancel
              </button>
              <button className="btn-primary" type="submit" disabled={debtSaving}>
                {debtSaving ? 'Saving...' : debtMode === 'edit' ? 'Update debt' : 'Save debt'}
              </button>
            </div>
          </form>
        </div>
      )}

      {goalOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-panel" onSubmit={submitGoal}>
            <div className="modal-head">
              <div>
                <div className="card-label">Goal</div>
                <div className="modal-title">{goalMode === 'edit' ? 'Edit goal' : 'Add goal'}</div>
              </div>
              <button className="icon-btn" type="button" onClick={closeGoalModal} aria-label="Close">
                ×
              </button>
            </div>

            <div className="form-grid">
              <label className="form-field">
                <span>Owner</span>
                <select
                  value={goalForm.ownerSlug}
                  onChange={(event) => updateGoalField('ownerSlug', event.target.value)}
                >
                  {householdMembers.map((member) => (
                    <option key={member.slug} value={member.slug}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Name</span>
                <input
                  required
                  value={goalForm.name}
                  onChange={(event) => updateGoalField('name', event.target.value)}
                  placeholder="Goal name"
                />
              </label>
              <label className="form-field">
                <span>Current amount</span>
                <input
                  required
                  min="0"
                  step="0.01"
                  type="number"
                  value={goalForm.currentAmount}
                  onChange={(event) => updateGoalField('currentAmount', event.target.value)}
                  placeholder="0.00"
                />
              </label>
              <label className="form-field">
                <span>Target amount</span>
                <input
                  required
                  min="0"
                  step="0.01"
                  type="number"
                  value={goalForm.targetAmount}
                  onChange={(event) => updateGoalField('targetAmount', event.target.value)}
                  placeholder="0.00"
                />
              </label>
              <label className="form-field">
                <span>Target label</span>
                <input
                  value={goalForm.targetLabel}
                  onChange={(event) => updateGoalField('targetLabel', event.target.value)}
                  placeholder="by December"
                />
              </label>
              <label className="form-field">
                <span>Color</span>
                <input
                  list="goal-colors"
                  value={goalForm.color}
                  onChange={(event) => updateGoalField('color', event.target.value)}
                  placeholder="#1F7A4D"
                />
                <datalist id="goal-colors">
                  {goalColorOptions.map((color) => (
                    <option key={color} value={color} />
                  ))}
                </datalist>
              </label>
            </div>

            {goalError && <div className="form-error">{goalError}</div>}

            <div className="modal-actions">
              <button className="btn-ghost modal-cancel" type="button" onClick={closeGoalModal}>
                Cancel
              </button>
              <button className="btn-primary" type="submit" disabled={goalSaving}>
                {goalSaving ? 'Saving...' : goalMode === 'edit' ? 'Update goal' : 'Save goal'}
              </button>
            </div>
          </form>
        </div>
      )}

      <footer className="site-footer">
        <span>Hearth · built by John & Stephanie, the long way around</span>
        <span>
          {accountSyncAge === 'never synced' ? 'Last sync unavailable' : `Last sync ${accountSyncAge}`}
          {' · '}
          {formatAccountCount(accountCount)}
          {' · '}
          {formatPlaidItemCount(plaidItemCount)}
        </span>
      </footer>
    </div>
  );
}
