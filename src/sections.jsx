/* eslint-disable */
/* Section panels for the dashboard */
import { Fragment } from 'react';
import { useAppState } from './app/AppState.jsx';
import { Avatar, Delta, Icon, MemberDot, MoneyV, Ring, Sparkline } from './components.jsx';

export function HeroNetWorth({ hidden, range, setRange }) {
  const { dashboardData: DATA } = useAppState();
  const nw = DATA.netWorth;
  return (
    <div className="card hero-networth">
      <div className="card-header">
        <div>
          <div className="card-label">Net worth</div>
          <div className="muted tiny" style={{ marginTop: 4 }}>Combined household · 11 accounts</div>
        </div>
        <div className="range-toggle">
          {['1M','3M','6M','1Y','ALL'].map(r => (
            <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>{r}</button>
          ))}
        </div>
      </div>
      <div className="figure">
        <MoneyV value={nw.total} size="big" serif hidden={hidden} cents />
        <Delta value={nw.delta30} />
        <span className="muted tiny">vs. 30 days ago</span>
      </div>
      <div className="spark-wrap">
        <Sparkline data={nw.history} color="var(--ink)" fill="rgba(31,122,77,0.10)" height={70} />
      </div>
    </div>
  );
}

export function HeroSpend({ hidden }) {
  const { dashboardData: DATA } = useAppState();
  const s = DATA.monthSpend;
  const pct = s.spent / s.budget;
  const remain = s.budget - s.spent;
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-label">This month · May</div>
          <div className="card-title" style={{ marginTop: 4 }}>Spend so far</div>
        </div>
        <span className="tag ok">on track</span>
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
  return (
    <div className="card dark">
      <div className="card-header">
        <div>
          <div className="card-label">Next 30 days</div>
          <div className="card-title" style={{ marginTop: 4, color: 'var(--paper)' }}>
            <em>Projected</em> cashflow
          </div>
        </div>
        <span className="tag" style={{ background: 'rgba(217,163,34,0.18)', color: 'var(--gold)' }}>healthy</span>
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

export function AccountsRail({ hidden }) {
  const { dashboardData: DATA } = useAppState();
  return (
    <div className="card" style={{ alignSelf: 'start' }}>
      <div className="card-header">
        <div>
          <div className="card-label">Accounts</div>
          <div className="card-title" style={{ marginTop: 4 }}>Where the <em>money</em> lives</div>
        </div>
        <button className="icon-btn" style={{ width: 28, height: 28 }} title="Add account"><Icon.Plus size={14} /></button>
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
                <div className="acct" key={a.name}>
                  <span className="acct-icon"><Ic /></span>
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
        <span className="muted">Linked institutions</span>
        <span><span className="live-dot"></span>Synced 4 min ago</span>
      </div>
    </div>
  );
}

export function SpendingCard({ hidden }) {
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
        {DATA.spending.map(c => {
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
  let bal = DATA.cashflow30.net + 8420; // start from checking
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

export function GoalsCard({ hidden }) {
  const { dashboardData: DATA } = useAppState();
  return (
    <div className="card" style={{ alignSelf: 'start' }}>
      <div className="card-header">
        <div>
          <div className="card-label">Goals</div>
          <div className="card-title" style={{ marginTop: 4 }}>What we're <em>saving for</em></div>
        </div>
        <button className="icon-btn" style={{ width: 28, height: 28 }} title="New goal"><Icon.Plus size={14} /></button>
      </div>

      {DATA.goals.map(g => {
        const pct = g.current / g.target;
        return (
          <div className="goal" key={g.name}>
            <div className="goal-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar who={g.owner} size={20} />
                <span className="goal-name">{g.name}</span>
              </div>
              <span className="goal-pct">{Math.round(pct * 100)}%</span>
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

export function TransactionsCard({ hidden }) {
  const { dashboardData: DATA } = useAppState();
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-label">Recent activity</div>
          <div className="card-title" style={{ marginTop: 4 }}>Latest <em>transactions</em></div>
        </div>
        <a className="link-arrow" href="#">View all →</a>
      </div>
      <div className="txn-list">
        {DATA.transactions.map(group => (
          <Fragment key={group.day}>
            <div className="txn-day">
              <span>{group.day}</span>
              <span>
                <MoneyV value={group.items.reduce((s,t)=>s+t.amt,0)} hidden={hidden} forceSign />
              </span>
            </div>
            {group.items.map((t, i) => (
              <div className="txn" key={i}>
                <div className="txn-emoji">{t.emoji}</div>
                <div>
                  <div className="txn-merch">{t.merch}</div>
                  <div className="txn-meta">
                    <span>{t.cat}</span>
                    <span>·</span>
                    <span>{t.time}</span>
                    <span>·</span>
                    <MemberDot who={t.who} />
                  </div>
                </div>
                <div className={`txn-amt ${t.income ? 'income' : ''}`}>
                  <MoneyV value={t.amt} hidden={hidden} forceSign={!t.income} cents />
                </div>
              </div>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

export function BillsCard({ hidden }) {
  const { dashboardData: DATA } = useAppState();
  const total = DATA.bills.reduce((s,b)=>s+b.amt,0);
  return (
    <div className="card" style={{ alignSelf: 'start' }}>
      <div className="card-header">
        <div>
          <div className="card-label">Upcoming bills</div>
          <div className="card-title" style={{ marginTop: 4 }}>Next <em>14 days</em></div>
        </div>
        <span className="muted tiny"><MoneyV value={total} hidden={hidden} /> total</span>
      </div>
      {DATA.bills.map((b, i) => (
        <div className={`bill ${b.soon ? 'due-soon' : ''}`} key={i}>
          <div className="bill-date">
            <div className="month">{b.date.m}</div>
            <div className="day">{b.date.d}</div>
          </div>
          <div>
            <div className="bill-name">{b.name}</div>
            <div className="bill-sub">{b.sub} · <MemberDot who={b.who} /></div>
          </div>
          <div className="bill-amt"><MoneyV value={b.amt} hidden={hidden} /></div>
        </div>
      ))}
    </div>
  );
}

export function InvestmentsCard({ hidden }) {
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
        <div className="inv-row" key={h.tk}>
          <div>
            <div className="inv-ticker">{h.tk}</div>
            <div className="inv-name">{h.name}</div>
          </div>
          <MoneyV value={h.val} hidden={hidden} />
          <span className={`delta ${h.d > 0 ? 'up' : h.d < 0 ? 'down' : 'flat'}`}>
            {h.d > 0 ? '↑' : h.d < 0 ? '↓' : '·'} {Math.abs(h.d).toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  );
}

export function DebtCard({ hidden }) {
  const { dashboardData: DATA } = useAppState();
  return (
    <div className="card" style={{ alignSelf: 'start' }}>
      <div className="card-header">
        <div>
          <div className="card-label">Debt payoff</div>
          <div className="card-title" style={{ marginTop: 4 }}>Climbing <em>down</em></div>
        </div>
        <span className="tag warn">3 active</span>
      </div>
      {DATA.debts.map(d => {
        const pct = d.paid / d.total;
        return (
          <div className="debt" key={d.name}>
            <div className="debt-head">
              <span className="debt-name">{d.name}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{d.apr}% APR</span>
            </div>
            <div className="debt-bar">
              <div className="debt-bar-fill" style={{ width: (pct * 100) + '%' }}></div>
            </div>
            <div className="debt-meta">
              <span><MoneyV value={d.paid} hidden={hidden} /> paid of <MoneyV value={d.total} hidden={hidden} /></span>
              <span>{d.revolving ? 'min ' : ''}<MoneyV value={d.pmt} hidden={hidden} />/mo · {d.end}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function KidsCard({ hidden, chores, toggleChore }) {
  const { dashboardData: DATA } = useAppState();
  return (
    <div className="kids-card">
      <div className="kids-head">
        <div>
          <div className="card-label">Kids' allowance</div>
          <div className="card-title" style={{ marginTop: 4, fontSize: 24 }}>
            <em>The little</em> Harpers
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-ghost" style={{ borderColor: 'var(--line-2)', color: 'var(--ink)' }}>History</button>
          <button className="btn-primary">Pay weekly allowance</button>
        </div>
      </div>
      <div className="kids-grid-inner">
        {DATA.kids.map((k, ki) => (
          <div className="kid-panel" key={k.who}>
            <div className="kid-head">
              <Avatar who={k.who} size={44} />
              <div>
                <div className="kid-name"><em>{k.name}</em></div>
                <div className="kid-meta">Age {k.age} · weekly allowance $5.00</div>
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
                      {done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </span>
                    <span className="chore-label">{c.label}</span>
                    <span className="chore-reward">+${c.reward.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
