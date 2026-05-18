/* eslint-disable */
/* Section panels for the dashboard */
import { Fragment, useState } from 'react';
import { useAppState } from './app/AppState.jsx';
import { Avatar, Delta, Icon, MemberDot, MoneyV, Ring, Sparkline } from './components.jsx';
import { getSuggestedChoreTemplates } from './lib/chore-templates.js';
import { getCashflowStartingBalance, getCashflowStatus } from './lib/cashflow.js';
import { getBudgetStatus } from './lib/budget.js';
import { getDebtProjection } from './lib/debts.js';
import {
  countDashboardAccounts,
  countLinkedPlaidItems,
  formatAccountCount,
  formatAccountSyncAge,
  formatPlaidItemCount,
} from './lib/accounts.js';
import { formatBillsWindowLabel } from './lib/date-range.js';
import { getNetWorthWindow } from './lib/net-worth.js';

export function HeroNetWorth({ hidden, range, setRange }) {
  const { dashboardData: DATA } = useAppState();
  const nw = DATA.netWorth;
  const netWorthWindow = getNetWorthWindow(nw.history, range);
  const accountCount = countDashboardAccounts(DATA);
  return (
    <div className="card hero-networth">
      <div className="card-header">
        <div>
          <div className="card-label">Net worth</div>
          <div className="muted tiny" style={{ marginTop: 4 }}>Combined household · {formatAccountCount(accountCount)}</div>
        </div>
        <div className="range-toggle">
          {['1M','3M','6M','1Y','ALL'].map((r) => (
            <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)} type="button">{r}</button>
          ))}
        </div>
      </div>
      <div className="figure">
        <MoneyV value={netWorthWindow.total} size="big" serif hidden={hidden} cents />
        <Delta value={netWorthWindow.delta} />
        <span className="muted tiny">{netWorthWindow.label}</span>
      </div>
      <div className="spark-wrap">
        <Sparkline data={netWorthWindow.history} color="var(--ink)" fill="rgba(31,122,77,0.10)" height={70} />
      </div>
    </div>
  );
}

export function HeroSpend({ hidden }) {
  const { dashboardData: DATA } = useAppState();
  const s = DATA.monthSpend;
  const pct = s.spent / s.budget;
  const remain = s.budget - s.spent;
  const budgetStatus = getBudgetStatus(s.spent, s.budget);
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-label">This month · May</div>
          <div className="card-title" style={{ marginTop: 4 }}>Spend so far</div>
        </div>
        <span className={`tag ${budgetStatus.tagClass}`}>{budgetStatus.label}</span>
      </div>
      <div className="ring-stat">
        <Ring value={s.spent} total={s.budget} size={100} stroke={11} color="var(--red)" track="var(--paper-2)">
          <div className="money" style={{ fontSize: 18, fontWeight: 600 }}>{Math.round(pct*100)}%</div>
          <div className="muted tiny" style={{ marginTop: 2 }}>of budget</div>
        </Ring>
        <div className="ring-num">
          <MoneyV value={s.spent} size="med" serif hidden={hidden} />
          <div className="muted tiny">of <MoneyV value={s.budget} hidden={hidden} /> budgeted</div>
          <div style={{ marginTop: 10 }}>
            <MoneyV value={remain} className="" hidden={hidden} /> <span className="muted tiny">left for {s.daysLeft} days</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroCashflow({ hidden }) {
  const { dashboardData: DATA } = useAppState();
  const c = DATA.cashflow30;
  const cashflowStatus = getCashflowStatus(c);
  return (
    <div className="card dark">
      <div className="card-header">
        <div>
          <div className="card-label">Next 30 days</div>
          <div className="card-title" style={{ marginTop: 4, color: 'var(--paper)' }}>
            <em>Projected</em> cashflow
          </div>
        </div>
        <span className={`tag ${cashflowStatus.tagClass}`}>{cashflowStatus.label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
        <MoneyV value={c.net} size="big" serif hidden={hidden} forceSign />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
        <div>
          <div className="muted tiny" style={{ marginBottom: 4 }}>Incoming</div>
          <div style={{ color: 'var(--green)', fontFamily: 'var(--mono)', fontSize: 16 }}>
            +<MoneyV value={c.incoming} hidden={hidden} />
          </div>
        </div>
        <div>
          <div className="muted tiny" style={{ marginBottom: 4 }}>Outgoing</div>
          <div style={{ color: 'var(--red)', fontFamily: 'var(--mono)', fontSize: 16 }}>
            −<MoneyV value={c.outgoing} hidden={hidden} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AccountsRail({ hidden, onAddAccount, onEditAccount, onSyncPlaidAccounts }) {
  const { dashboardData: DATA } = useAppState();
  const plaidItemCount = countLinkedPlaidItems(DATA);
  const syncAge = formatAccountSyncAge(DATA);
  return (
    <div className="card" style={{ alignSelf: 'start' }}>
      <div className="card-header">
        <div>
          <div className="card-label">Accounts</div>
          <div className="card-title" style={{ marginTop: 4 }}>Where the <em>money</em> lives</div>
        </div>
        <button className="icon-btn" style={{ width: 28, height: 28 }} title="Add account" type="button" onClick={() => onAddAccount?.()}>
          <Icon.Plus size={14} />
        </button>
      </div>
      <div className="accounts-rail-actions">
        <button
          className="btn-ghost"
          type="button"
          onClick={() => onSyncPlaidAccounts?.()}
          disabled={!plaidItemCount}
        >
          Sync Plaid
        </button>
        <span className="muted tiny">Pull fresh balances and transactions from Plaid.</span>
      </div>

      {DATA.accounts.map(g => (
        <Fragment key={g.group}>
          <div className="section-head">
            <h4>{g.group}</h4>
            <span className="muted tiny">{g.items.length}</span>
          </div>
          <div className="acct-list">
            {g.items.map(a => {
              const Ic = Icon[a.icon] || Icon.Bank;
              const neg = a.bal < 0;
              return (
                <div className="acct" key={a.id ?? a.name}>
                  <button
                    className="acct-icon acct-edit"
                    type="button"
                    title={`Edit ${a.name}`}
                    aria-label={`Edit ${a.name}`}
                    onClick={() => onEditAccount?.(a)}
                  >
                    <Ic />
                  </button>
                  <div>
                    <div className="acct-name">{a.name}</div>
                    <div className="acct-sub">{a.sub}</div>
                  </div>
                  <div className={`acct-bal ${neg ? 'neg' : ''}`}>
                    <MoneyV value={a.bal} hidden={hidden} forceSign={neg} />
                  </div>
                </div>
              );
            })}
          </div>
        </Fragment>
      ))}

      <div className="divider" />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span className="muted">Linked Plaid items · {formatPlaidItemCount(plaidItemCount)}</span>
        <span><span className="live-dot"></span>{syncAge === 'never synced' ? 'Sync unavailable' : `Synced ${syncAge}`}</span>
      </div>
    </div>
  );
}

export function SpendingCard({ hidden, onAdjustBudget }) {
  const { dashboardData: DATA } = useAppState();
  const total = DATA.spending.reduce((s, c) => s + c.spent, 0);
  const totalBudget = DATA.spending.reduce((s, c) => s + c.budget, 0);
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-label">Spending by category · May</div>
          <div className="card-title" style={{ marginTop: 4 }}><em>Budgets</em> vs. actuals</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="muted tiny">total</span>
          <MoneyV value={total} hidden={hidden} />
          <span className="muted tiny">of</span>
          <MoneyV value={totalBudget} hidden={hidden} />
        </div>
      </div>

      <div>
        {DATA.spending.map((c) => {
          const pct = c.spent / c.budget;
          const over = c.spent > c.budget;
          const widthPct = Math.min(100, pct * 100);
          return (
            <div className="spend-row" key={c.cat}>
              <div className="spend-cat">
                <span className="cat-swatch" style={{ background: c.color }}></span>
                {c.cat}
              </div>
              <div className="spend-bar">
                <div className={`spend-bar-fill ${over ? 'over' : ''}`}
                     style={{ width: widthPct + '%', background: over ? undefined : c.color }}>
                  {Math.round(pct * 100)}%
                </div>
                {/* Budget marker at 100% always at right edge - here we mark with line at the budget position relative to a max bar */}
              </div>
              <div className="spend-vals">
                <MoneyV value={c.spent} hidden={hidden} /> <span className="of">/ <MoneyV value={c.budget} hidden={hidden} /></span>
              </div>
              <button
                className="spend-edit"
                type="button"
                title={`Adjust ${c.cat} budget`}
                aria-label={`Adjust ${c.cat} budget`}
                onClick={() => onAdjustBudget?.(c)}
              >
                Adjust
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ForecastCard({ hidden }) {
  const { dashboardData: DATA } = useAppState();
  const fc = DATA.forecast;
  const w = 720;
  const h = 220;
  const pad = { l: 54, r: 16, t: 24, b: 32 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const max = Math.max(...fc.map(f => Math.max(f.in, f.out))) * 1.15;
  const bw = innerW / fc.length;
  const yTicks = [0, max * 0.5, max];

  // Compute running balance
  const startingBalance = getCashflowStartingBalance(DATA.accounts, DATA.transactions);
  let bal = DATA.cashflow30.net + startingBalance;
  const balPath = fc.map((f, i) => {
    bal += f.in - f.out;
    const x = pad.l + i * bw + bw / 2;
    const y = pad.t + innerH - (Math.max(0, Math.min(max, bal)) / max) * innerH;
    return [x, y];
  });
  const linePath = balPath.map((p, i) => `${i===0?'M':'L'}${p[0]},${p[1]}`).join(' ');

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-label">Cashflow forecast · 12 weeks</div>
          <div className="card-title" style={{ marginTop: 4 }}>What's <em>coming</em></div>
          <div className="cashflow-starting-balance">
            Anchored to spendable cash balance · <MoneyV value={startingBalance} hidden={hidden} cents />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 11 }}>
          <span><span style={{ display:'inline-block', width:10,height:10,background:'var(--green)',borderRadius:2,marginRight:5,verticalAlign:'middle' }}></span>Income</span>
          <span><span style={{ display:'inline-block', width:10,height:10,background:'var(--red)',borderRadius:2,marginRight:5,verticalAlign:'middle' }}></span>Expenses</span>
          <span><span style={{ display:'inline-block', width:14,height:2,background:'var(--ink)',marginRight:5,verticalAlign:'middle' }}></span>Projected balance</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${w} ${h}`} className="cashflow-chart" preserveAspectRatio="none">
        {/* Grid */}
        {yTicks.map((t, i) => {
          const y = pad.t + innerH - (t / max) * innerH;
          return (
            <g key={i}>
              <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} stroke="var(--line)" strokeDasharray="2 4" />
              <text x={pad.l - 8} y={y + 4} textAnchor="end" fontSize="11" fill="var(--mute)" fontFamily="var(--mono)">
                {hidden ? '•••' : '$' + Math.round(t/1000) + 'k'}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {fc.map((f, i) => {
          const x = pad.l + i * bw;
          const inH = (f.in / max) * innerH;
          const outH = (f.out / max) * innerH;
          const barW = bw * 0.35;
          return (
            <g key={i}>
              <rect x={x + bw*0.15} y={pad.t + innerH - inH} width={barW} height={inH} fill="var(--green)" opacity="0.85" rx="2" />
              <rect x={x + bw*0.50} y={pad.t + innerH - outH} width={barW} height={outH} fill="var(--red)" opacity="0.85" rx="2" />
              {i % 2 === 0 && (
                <text x={x + bw/2} y={h - 10} textAnchor="middle" fontSize="11" fill="var(--mute)" fontFamily="var(--mono)">{f.week}</text>
              )}
            </g>
          );
        })}

        {/* Balance line */}
        <path d={linePath} fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        {balPath.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill="var(--card)" stroke="var(--ink)" strokeWidth="1.4" />
        ))}

        {/* Today line */}
        <line x1={pad.l + bw * 0.4} x2={pad.l + bw * 0.4} y1={pad.t - 4} y2={h - pad.b} stroke="var(--ink)" strokeDasharray="3 3" strokeWidth="1" />
        <text x={pad.l + bw * 0.4 + 5} y={pad.t + 7} fontSize="10" fill="var(--ink)" fontFamily="var(--mono)" fontWeight="600" letterSpacing="0.5">TODAY</text>
      </svg>
    </div>
  );
}

export function GoalsCard({ hidden, onAddGoal, onEditGoal }) {
  const { dashboardData: DATA } = useAppState();
  return (
    <div className="card" style={{ alignSelf: 'start' }}>
      <div className="card-header">
        <div>
          <div className="card-label">Goals</div>
          <div className="card-title" style={{ marginTop: 4 }}>What we're <em>saving for</em></div>
        </div>
        <button className="icon-btn" style={{ width: 28, height: 28 }} title="New goal" type="button" onClick={() => onAddGoal?.()}>
          <Icon.Plus size={14} />
        </button>
      </div>

      {DATA.goals.map((g) => {
        const pct = g.current / g.target;
        return (
          <div className="goal" key={g.id ?? g.name}>
            <div className="goal-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar who={g.owner} size={20} />
                <span className="goal-name">{g.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="goal-pct">{Math.round(pct * 100)}%</span>
                {g.id != null && (
                  <button
                    className="icon-btn goal-edit"
                    type="button"
                    title={`Edit ${g.name}`}
                    aria-label={`Edit ${g.name}`}
                    onClick={() => onEditGoal?.(g)}
                  >
                    ✎
                  </button>
                )}
              </div>
            </div>
            <div className="goal-bar">
              <div className="goal-bar-fill" style={{ width: (pct * 100) + '%', background: g.color }}></div>
            </div>
            <div className="goal-meta">
              <span><MoneyV value={g.current} hidden={hidden} /> / <MoneyV value={g.target} hidden={hidden} /></span>
              <span>by {g.by}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TransactionsCard({ hidden, onEditTransaction, onViewAll }) {
  const { dashboardData: DATA, dashboardSource, deleteTransaction } = useAppState();
  const recentGroups = useMemo(() => {
    const recentRows = DATA.transactions
      .flatMap((group) => group.items.map((item, itemIndex) => ({
        ...item,
        dayLabel: group.day,
        date: group.date,
        itemIndex,
      })))
      .slice(0, 10);

    const groups = [];
    const indexByKey = new Map();

    for (const row of recentRows) {
      const key = row.date || row.dayLabel || 'unknown';

      if (!indexByKey.has(key)) {
        indexByKey.set(key, groups.length);
        groups.push({
          key,
          dayLabel: row.dayLabel || row.date || 'Transactions',
          date: row.date || null,
          items: [],
        });
      }

      groups[indexByKey.get(key)].items.push(row);
    }

    return groups;
  }, [DATA.transactions]);

  async function handleDeleteTransaction(transaction) {
    if (dashboardSource !== 'database') {
      return;
    }

    const confirmed = window.confirm(`Delete ${transaction.merch}?`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteTransaction(transaction.id);
    } catch (error) {
      window.alert(error.message);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-label">Recent activity</div>
          <div className="card-title" style={{ marginTop: 4 }}>Latest 10 <em>transactions</em></div>
        </div>
        <button className="link-arrow" type="button" onClick={() => onViewAll?.()}>View all →</button>
      </div>
      <div className="txn-list">
        {recentGroups.map(group => (
          <Fragment key={group.key}>
            <div className="txn-day">
              <span>{group.dayLabel}</span>
              <span>
                <MoneyV value={group.items.reduce((s,t)=>s+t.amt,0)} hidden={hidden} forceSign />
              </span>
            </div>
            {group.items.map((t, i) => (
              <div className="txn" key={t.id ?? i}>
                <div className="txn-emoji">{t.emoji}</div>
                <div>
                  <div className="txn-merch">{t.merch}</div>
                  <div className="txn-meta">
                    <span>{t.cat}</span>
                    <span>·</span>
                    <span>{t.time}</span>
                    <span>·</span>
                    <MemberDot who={t.who} />
                    {t.syncStatus === 'pending' && <span className="tag warn">Pending</span>}
                  </div>
                </div>
                <div className="txn-actions">
                  <div className={`txn-amt ${t.income ? 'income' : ''}`}>
                    <MoneyV value={t.amt} hidden={hidden} forceSign={!t.income} cents />
                  </div>
                  {dashboardSource === 'database' && t.id && (
                    <>
                      <button
                      className="icon-btn txn-edit"
                      type="button"
                      title={`Edit ${t.merch}`}
                      aria-label={`Edit ${t.merch}`}
                        onClick={() => onEditTransaction?.({ ...t, postedLabel: group.day, postedDate: group.date })}
                      >
                        ✎
                      </button>
                      <button
                        className="icon-btn txn-delete"
                        type="button"
                        title={`Delete ${t.merch}`}
                        aria-label={`Delete ${t.merch}`}
                        onClick={() => handleDeleteTransaction(t)}
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

export function BillsCard({ hidden, onAddBill, onEditBill, onSetBillStatus }) {
  const { dashboardData: DATA } = useAppState();
  const total = DATA.bills.reduce((s,b)=>s+b.amt,0);
  const billsWindowLabel = formatBillsWindowLabel(DATA.asOfDate ?? DATA.asOf);
  return (
    <div className="card" style={{ alignSelf: 'start' }}>
      <div className="card-header">
        <div>
          <div className="card-label">Upcoming bills</div>
          <div className="card-title" style={{ marginTop: 4 }}>{billsWindowLabel}</div>
        </div>
        <button className="icon-btn" style={{ width: 28, height: 28 }} title="Add bill" type="button" onClick={() => onAddBill?.()}>
          <Icon.Plus size={14} />
        </button>
      </div>
      <div className="bill-total">
        <span className="muted tiny"><MoneyV value={total} hidden={hidden} /> total</span>
      </div>
      {DATA.bills.map((b) => (
        <div className={`bill ${b.soon ? 'due-soon' : ''}`} key={b.id ?? `${b.name}-${b.date.m}-${b.date.d}`}>
          <div className="bill-date">
            <div className="month">{b.date.m}</div>
            <div className="day">{b.date.d}</div>
          </div>
        <div className="bill-copy">
          <div className="bill-head">
            <div className="bill-name-wrap">
              <div className="bill-name">{b.name}</div>
              <div className="bill-sub">{b.sub} · <MemberDot who={b.who} /></div>
            </div>
            <div className="bill-actions">
              {b.externalProvider === 'plaid' && <span className="tag">Plaid</span>}
              {b.status === 'upcoming' && (
                <span className={`tag ${b.soon ? 'warn' : ''}`}>{b.soon ? 'Due soon' : 'Upcoming'}</span>
              )}
              {b.status === 'paid' && <span className="tag ok">Paid</span>}
              {b.status === 'snoozed' && <span className="tag">Snoozed</span>}
                <button
                  className="icon-btn bill-edit"
                  type="button"
                  title={`Edit ${b.name}`}
                  aria-label={`Edit ${b.name}`}
                  onClick={() => onEditBill?.(b)}
                >
                  ✎
                </button>
              </div>
            </div>
            <div className="bill-foot">
              <div className="bill-amt"><MoneyV value={b.amt} hidden={hidden} /></div>
              <div className="bill-row-actions">
                <button
                  className="btn-ghost bill-action"
                  type="button"
                  onClick={() => onSetBillStatus?.(b.id, 'paid')}
                >
                  Mark paid
                </button>
                <button
                  className="btn-ghost bill-action"
                  type="button"
                  onClick={() => onSetBillStatus?.(b.id, 'snoozed')}
                >
                  Snooze
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function InvestmentsCard({ hidden, onEditInvestment }) {
  const { dashboardData: DATA } = useAppState();
  const inv = DATA.investments;
  return (
    <div className="card" style={{ alignSelf: 'start' }}>
      <div className="card-header">
        <div>
          <div className="card-label">Investments</div>
          <div className="card-title" style={{ marginTop: 4 }}>Portfolio <em>today</em></div>
        </div>
        <Delta value={inv.delta} kind={inv.delta > 0 ? 'up' : 'down'} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <MoneyV value={inv.total} size="med" serif hidden={hidden} />
        <div className="muted tiny" style={{ marginTop: 2 }}>
          {inv.delta > 0 ? '+' : '−'}<MoneyV value={Math.abs(inv.delta)} hidden={hidden} /> · {inv.deltaPct}% today
        </div>
      </div>
      {inv.holdings.map(h => (
        <div className="inv-row" key={h.id ?? h.tk}>
          <div>
            <div className="inv-ticker">{h.tk}</div>
            <div className="inv-name">{h.name}</div>
          </div>
          <MoneyV value={h.val} hidden={hidden} />
          <span className={`delta ${h.d > 0 ? 'up' : h.d < 0 ? 'down' : 'flat'}`}>
            {h.d > 0 ? '↑' : h.d < 0 ? '↓' : '·'} {Math.abs(h.d).toFixed(2)}%
          </span>
          <button
            className="icon-btn inv-edit"
            type="button"
            title={`Edit ${h.tk}`}
            aria-label={`Edit ${h.tk}`}
            onClick={() => onEditInvestment?.(h)}
          >
            ✎
          </button>
        </div>
      ))}
    </div>
  );
}

export function DebtCard({ hidden, onAddDebt, onEditDebt }) {
  const { dashboardData: DATA } = useAppState();
  const debtCount = DATA.debts.length;
  return (
    <div className="card" style={{ alignSelf: 'start' }}>
      <div className="card-header">
        <div>
          <div className="card-label">Debt payoff</div>
          <div className="card-title" style={{ marginTop: 4 }}>Climbing <em>down</em></div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="tag warn">{debtCount} active</span>
          <button className="icon-btn" style={{ width: 28, height: 28 }} title="Add debt" type="button" onClick={() => onAddDebt?.()}>
            <Icon.Plus size={14} />
          </button>
        </div>
      </div>
      {DATA.debts.map(d => {
        const projection = getDebtProjection(d, DATA.asOfDate);
        const pct = projection.progressPct / 100;
        const imported = d.externalProvider === 'plaid';
        const currentBalance = d.currentBalance != null ? d.currentBalance : null;
        const balanceTotal = d.creditLimit || d.total;
        const displayPayment = d.minimumPaymentAmount ?? d.pmt;
        return (
          <div className="debt" key={d.id ?? d.name}>
            <div className="debt-head">
              <span className="debt-name-wrap">
                <span className="debt-name">{d.name}</span>
                <span className="debt-projection">
                  {projection.status === 'projected' && `Est. payoff ${projection.payoffLabel}`}
                  {projection.status === 'warning' && 'Payment too low to retire balance'}
                  {projection.status === 'unknown' && 'Projection unavailable'}
                  {projection.status === 'paid' && 'Paid off'}
                </span>
              </span>
              <span className="debt-head-right">
                {imported && <span className="tag">Plaid</span>}
                <span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{d.apr}% APR</span>
                <button
                  className="icon-btn debt-edit"
                  type="button"
                  title={`Edit ${d.name}`}
                  aria-label={`Edit ${d.name}`}
                  onClick={() => onEditDebt?.(d)}
                >
                  ✎
                </button>
              </span>
            </div>
            <div className="debt-bar">
              <div className="debt-bar-fill" style={{ width: (pct * 100) + '%' }}></div>
            </div>
            <div className="debt-meta">
              {imported && currentBalance != null ? (
                <span>
                  <MoneyV value={currentBalance} hidden={hidden} /> balance
                  {balanceTotal ? <span> of <MoneyV value={balanceTotal} hidden={hidden} /> limit</span> : null}
                </span>
              ) : (
                <span><MoneyV value={d.paid} hidden={hidden} /> paid of <MoneyV value={d.total} hidden={hidden} /></span>
              )}
              <span>{d.revolving ? 'min ' : ''}<MoneyV value={displayPayment} hidden={hidden} />/mo · {d.end}</span>
            </div>
            <div className="debt-details">
              <span>{projection.remaining > 0 ? <MoneyV value={projection.remaining} hidden={hidden} /> : '0.00'} remaining</span>
              {projection.estimatedInterest != null && (
                <span>Est. interest <MoneyV value={projection.estimatedInterest} hidden={hidden} /></span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function KidsCard({
  hidden,
  chores,
  toggleChore,
  onAddChore,
  onUpdateChore,
  onDeleteChore,
  onPayWeeklyAllowance,
  onVoidLatestAllowance,
  allowanceSaving = false,
  allowanceVoiding = false,
  allowanceError = '',
}) {
  const { dashboardData: DATA } = useAppState();
  const [showHistory, setShowHistory] = useState(true);
  const [choreError, setChoreError] = useState('');
  const [choreSavingKey, setChoreSavingKey] = useState('');
  const [choreEditorOpen, setChoreEditorOpen] = useState(false);
  const [choreEditorSaving, setChoreEditorSaving] = useState(false);
  const [choreEditorError, setChoreEditorError] = useState('');
  const [choreEditorForm, setChoreEditorForm] = useState({
    choreId: null,
    memberSlug: '',
    label: '',
    reward: '',
    done: false,
  });
  const allowance = DATA.allowance || { weeklyAmount: 5, split: { spend: 0.5, save: 0.3, give: 0.2 } };
  const history = DATA.allowanceHistory || [];
  const splitPercentages = [
    Math.round((allowance.split?.spend ?? 0.5) * 100),
    Math.round((allowance.split?.save ?? 0.3) * 100),
    Math.round((allowance.split?.give ?? 0.2) * 100),
  ];

  async function handleAddChore(kid, template) {
    const key = `${kid.who}:${template.label}`;
    setChoreError('');
    setChoreSavingKey(key);

    try {
      await onAddChore?.({
        memberSlug: kid.who,
        label: template.label,
        reward: template.reward,
      });
    } catch (error) {
      setChoreError(error.message);
    } finally {
      setChoreSavingKey('');
    }
  }

  function openChoreEditor(kid, chore) {
    setChoreEditorError('');
    setChoreEditorForm({
      choreId: chore.id,
      memberSlug: kid.who,
      label: chore.label,
      reward: String(chore.reward ?? 0),
      done: Boolean(chore.done),
    });
    setChoreEditorOpen(true);
  }

  function closeChoreEditor() {
    setChoreEditorOpen(false);
    setChoreEditorSaving(false);
    setChoreEditorError('');
    setChoreEditorForm({
      choreId: null,
      memberSlug: '',
      label: '',
      reward: '',
      done: false,
    });
  }

  async function handleSubmitChoreEditor(event) {
    event.preventDefault();
    setChoreEditorSaving(true);
    setChoreEditorError('');

    try {
      await onUpdateChore?.(choreEditorForm.choreId, {
        memberSlug: choreEditorForm.memberSlug,
        label: choreEditorForm.label,
        reward: Number(choreEditorForm.reward),
        done: choreEditorForm.done,
      });
      closeChoreEditor();
    } catch (error) {
      setChoreEditorError(error.message);
      setChoreEditorSaving(false);
    }
  }

  async function handleDeleteChore(kid, chore) {
    if (typeof window !== 'undefined' && !window.confirm(`Delete ${chore.label}?`)) {
      return;
    }

    setChoreError('');
    setChoreSavingKey(`delete:${chore.id}`);

    try {
      await onDeleteChore?.(chore.id);
    } catch (error) {
      setChoreError(error.message);
    } finally {
      setChoreSavingKey('');
    }
  }

  return (
    <div className="kids-card">
      <div className="kids-head">
        <div>
          <div className="card-label">Kids' allowance</div>
          <div className="card-title" style={{ marginTop: 4, fontSize: 24 }}>
            <em>The young</em> Czechowskis
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            className="btn-ghost"
            style={{ borderColor: 'var(--line-2)', color: 'var(--ink)' }}
            type="button"
            onClick={() => setShowHistory((current) => !current)}
          >
            {showHistory ? 'Hide history' : 'History'}
          </button>
          <button
            className="btn-primary"
            type="button"
            onClick={() => onPayWeeklyAllowance?.()}
            disabled={allowanceSaving || allowanceVoiding}
          >
            {allowanceSaving ? 'Paying allowance...' : 'Pay weekly allowance'}
          </button>
          <button
            className="btn-ghost"
            style={{ borderColor: 'var(--line-2)', color: 'var(--ink)' }}
            type="button"
            onClick={() => onVoidLatestAllowance?.()}
            disabled={allowanceSaving || allowanceVoiding || !history.length}
          >
            {allowanceVoiding ? 'Voiding...' : 'Void latest payout'}
          </button>
        </div>
      </div>

      <div className="kids-allowance-meta muted tiny">
        Weekly allowance <MoneyV value={allowance.weeklyAmount} hidden={hidden} cents /> split {splitPercentages.join('/')} percent across spend, save, and give.
        {history[0] ? (
          <>
            {' '}Last payout <strong>{history[0].label}</strong> for <MoneyV value={history[0].total} hidden={hidden} cents />.
          </>
        ) : (
          ' No payouts have been recorded yet.'
        )}
      </div>

      {allowanceError ? <div className="kids-allowance-error tag alert">{allowanceError}</div> : null}

      <div className="kids-grid-inner">
        {DATA.kids.map((k, ki) => (
          <div className="kid-panel" key={k.who}>
            <div className="kid-head">
              <Avatar who={k.who} size={44} />
              <div>
                <div className="kid-name"><em>{k.name}</em></div>
                <div className="kid-meta">Age {k.age} · weekly allowance <MoneyV value={k.weeklyAllowance ?? allowance.weeklyAmount} hidden={hidden} cents /></div>
              </div>
            </div>
            <div className="kid-balance">
              <span className="muted tiny">Balance</span>
              <MoneyV value={k.balance} size="med" serif hidden={hidden} cents />
            </div>
            <div className="kid-jars">
              <div className="jar"><div className="jar-label">Spend</div><div className="jar-val"><MoneyV value={k.jars.spend} hidden={hidden} cents /></div></div>
              <div className="jar"><div className="jar-label">Save</div><div className="jar-val"><MoneyV value={k.jars.save} hidden={hidden} cents /></div></div>
              <div className="jar"><div className="jar-label">Give</div><div className="jar-val"><MoneyV value={k.jars.give} hidden={hidden} cents /></div></div>
            </div>
            <div className="card-label" style={{ marginBottom: 8 }}>This week's chores</div>
            <div className="chore-list">
              {k.chores.map((c, ci) => {
                const key = c.id ? `chore-${c.id}` : `${ki}-${ci}`;
                const done = chores[key] ?? c.done;
                return (
                  <div className={`chore ${done ? 'done' : ''}`} key={ci}>
                    <span className="chore-check" onClick={() => toggleChore(key, !done, c.id)}>
                      {done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                    </span>
                    <span className="chore-label">{c.label}</span>
                    <span className="chore-actions">
                      <span className="chore-reward">+${c.reward.toFixed(2)}</span>
                      <button className="chore-action" type="button" onClick={() => openChoreEditor(k, { ...c, done })}>
                        Edit
                      </button>
                      <button
                        className="chore-action danger"
                        type="button"
                        onClick={() => handleDeleteChore(k, c)}
                        disabled={choreSavingKey === `delete:${c.id}`}
                      >
                        Delete
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="card-label" style={{ margin: '12px 0 8px' }}>Age-aware chore templates</div>
            <div className="chore-template-list">
              {getSuggestedChoreTemplates(k.age).map((template) => {
                const key = `${k.who}:${template.label}`;
                const exists = k.chores.some((chore) => chore.label === template.label);
                const saving = choreSavingKey === key;

                return (
                  <button
                    className="chore-template"
                    key={template.label}
                    type="button"
                    onClick={() => handleAddChore(k, template)}
                    disabled={exists || saving}
                    title={template.ageBand}
                  >
                    <div className="chore-template-head">
                      <span className="chore-template-label">{template.label}</span>
                      <span className="chore-template-reward">+${template.reward.toFixed(2)}</span>
                    </div>
                    <div className="chore-template-meta">
                      {template.ageBand}
                      {exists ? ' · already on list' : ''}
                    </div>
                    <div className="chore-template-action">Add chore</div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {choreError ? <div className="kids-allowance-error tag alert">{choreError}</div> : null}

      {choreEditorOpen ? (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-panel" onSubmit={handleSubmitChoreEditor}>
            <div className="modal-head">
              <div>
                <div className="card-label">Chore</div>
                <div className="modal-title">Edit chore</div>
              </div>
              <button className="icon-btn" type="button" onClick={closeChoreEditor} aria-label="Close">
                ×
              </button>
            </div>

            <label className="form-field">
              <span>Kid</span>
              <select
                value={choreEditorForm.memberSlug}
                onChange={(event) => setChoreEditorForm((current) => ({ ...current, memberSlug: event.target.value }))}
              >
                {DATA.kids.map((kid) => (
                  <option key={kid.who} value={kid.who}>
                    {kid.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Label</span>
              <input
                required
                value={choreEditorForm.label}
                onChange={(event) => setChoreEditorForm((current) => ({ ...current, label: event.target.value }))}
              />
            </label>

            <label className="form-field">
              <span>Reward</span>
              <input
                min="0"
                step="0.01"
                type="number"
                value={choreEditorForm.reward}
                onChange={(event) => setChoreEditorForm((current) => ({ ...current, reward: event.target.value }))}
              />
            </label>

            <label className="form-check">
              <input
                type="checkbox"
                checked={choreEditorForm.done}
                onChange={(event) => setChoreEditorForm((current) => ({ ...current, done: event.target.checked }))}
              />
              <span>Done</span>
            </label>

            {choreEditorError ? <div className="form-error">{choreEditorError}</div> : null}

            <div className="modal-actions">
              <button className="btn-ghost modal-cancel" type="button" onClick={closeChoreEditor}>
                Cancel
              </button>
              <button className="btn-primary" type="submit" disabled={choreEditorSaving}>
                {choreEditorSaving ? 'Saving...' : 'Update chore'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="divider" />
      <div className="section-head kids-history-head">
        <h4>Allowance history</h4>
        <span className="muted tiny">{history.length.toLocaleString()} batches</span>
      </div>

      {showHistory ? (
        history.length ? (
          <div className="allowance-history">
            {history.map((batch) => (
              <div className="allowance-batch" key={batch.paidAt}>
                <div className="allowance-batch-head">
                  <div>
                    <div className="allowance-batch-title">{batch.label}</div>
                    <div className="muted tiny">
                      {batch.entries.length.toLocaleString()} kids · <MoneyV value={batch.total} hidden={hidden} cents /> paid out
                    </div>
                  </div>
                  <MoneyV value={batch.total} hidden={hidden} cents forceSign />
                </div>
                <div className="allowance-entry-list">
                  {batch.entries.map((entry) => (
                    <div className="allowance-entry" key={`${batch.paidAt}-${entry.memberSlug}`}>
                      <div className="allowance-entry-member">
                        <MemberDot who={entry.memberSlug} />
                        <div className="allowance-entry-name">{entry.memberName}</div>
                      </div>
                      <div className="allowance-entry-values">
                        <span><MoneyV value={entry.weeklyAmount} hidden={hidden} cents forceSign /></span>
                        <span className="muted tiny">
                          {Math.round((entry.spendAmount / entry.weeklyAmount) * 100)}/{Math.round((entry.saveAmount / entry.weeklyAmount) * 100)}/{Math.round((entry.giveAmount / entry.weeklyAmount) * 100)} split
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted tiny kids-history-empty">No allowance payouts recorded yet.</div>
        )
      ) : (
        <div className="muted tiny kids-history-empty">Allowance history is hidden.</div>
      )}
    </div>
  );
}
