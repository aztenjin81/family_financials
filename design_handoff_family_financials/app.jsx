/* eslint-disable */
const { useState, useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#C94A2C",
  "paper": "#F2EEE3",
  "showInsight": true,
  "compact": false
}/*EDITMODE-END*/;

function App() {
  const [hidden, setHidden] = useState(false);
  const [range, setRange] = useState('1Y');
  const [tab, setTab] = useState('Overview');
  const [chores, setChores] = useState({});
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Apply tweaks
  useEffect(() => {
    document.documentElement.style.setProperty('--red', tweaks.accent);
    document.documentElement.style.setProperty('--paper', tweaks.paper);
  }, [tweaks.accent, tweaks.paper]);

  const tabs = ['Overview', 'Budget', 'Accounts', 'Goals', 'Investments', 'Kids'];

  return (
    <div className="app">
      {/* Top bar */}
      <header className="topbar">
        <div className="brand">
          <div>
            <div className="brand-mark">Hearth<em>·</em></div>
            <div className="brand-sub" style={{ marginTop: 2 }}>{DATA.family}</div>
          </div>
        </div>

        <div className="topbar-center">
          {tabs.map(t => (
            <button key={t} className={`tab ${t === tab ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>

        <div className="topbar-right">
          <button className="icon-btn" title="Search"><Icon.Search /></button>
          <button className="icon-btn" title="Notifications" style={{ position: 'relative' }}>
            <Icon.Bell />
            <span style={{ position: 'absolute', top: 6, right: 8, width: 6, height: 6, borderRadius: 999, background: 'var(--red)' }}></span>
          </button>
          <button
            className={`icon-btn ${hidden ? 'on' : ''}`}
            onClick={() => setHidden(h => !h)}
            title={hidden ? 'Show balances' : 'Hide balances'}
          >
            <Icon.Eye open={!hidden} />
          </button>
          <div style={{ width: 1, height: 22, background: 'var(--line)', margin: '0 4px' }}></div>
          <div className="member-stack">
            <Avatar who="alex" />
            <Avatar who="sam" />
            <Avatar who="mia" />
            <Avatar who="theo" />
          </div>
        </div>
      </header>

      {/* Greeting + date */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div className="card-label">{DATA.asOf}</div>
          <h1 style={{
            fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 44, margin: '4px 0 0',
            letterSpacing: '-0.02em', lineHeight: 1.12, textWrap: 'balance'
          }}>
            Good morning, <em style={{ color: 'var(--red)' }}>Alex.</em>
          </h1>
          <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
            Here's what's happening with the household.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="icon-btn" style={{ width: 'auto', padding: '0 14px', fontSize: 12, fontWeight: 500, gap: 6 }}>
            <Icon.Plus size={14} /> Add transaction
          </button>
          <button className="icon-btn on" style={{ width: 'auto', padding: '0 14px', fontSize: 12, fontWeight: 500 }}>
            Reconcile accounts
          </button>
        </div>
      </div>

      {/* AI insight banner */}
      {tweaks.showInsight && (
        <div className="insight">
          <div className="insight-icon">✦</div>
          <div className="insight-body">
            <strong>Heads up · </strong>{DATA.insight.text}
          </div>
          <div className="insight-actions">
            <button className="btn-ghost">Dismiss</button>
            <button className="btn-primary">Adjust budget</button>
          </div>
        </div>
      )}

      {/* Hero row */}
      <div className="grid hero-grid">
        <HeroNetWorth hidden={hidden} range={range} setRange={setRange} />
        <HeroSpend hidden={hidden} />
        <HeroCashflow hidden={hidden} />
      </div>

      {/* Main row: accounts | spending+forecast | goals */}
      <div className="grid main-grid">
        <AccountsRail hidden={hidden} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SpendingCard hidden={hidden} />
          <ForecastCard hidden={hidden} />
        </div>
        <GoalsCard hidden={hidden} />
      </div>

      {/* Bottom: transactions | bills | investments + debt stacked */}
      <div className="grid bottom-grid">
        <TransactionsCard hidden={hidden} />
        <BillsCard hidden={hidden} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <InvestmentsCard hidden={hidden} />
          <DebtCard hidden={hidden} />
        </div>
      </div>

      {/* Kids zone */}
      <div className="grid kids-grid">
        <KidsCard hidden={hidden} chores={chores} toggleChore={(k, v) => setChores(c => ({ ...c, [k]: v }))} />
      </div>

      {/* Footer */}
      <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', color: 'var(--mute)', fontSize: 11 }}>
        <span>Hearth · built by Alex & Sam, the long way around</span>
        <span>Last sync 4 min ago · 11 accounts · 6 institutions</span>
      </div>

      {/* Tweaks panel */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme">
          <TweakColor
            label="Accent"
            value={tweaks.accent}
            onChange={v => setTweak('accent', v)}
            options={['#C94A2C', '#1F7A4D', '#2B5FB8', '#D9A322', '#6B3A85']}
          />
          <TweakColor
            label="Paper"
            value={tweaks.paper}
            onChange={v => setTweak('paper', v)}
            options={['#F2EEE3', '#ECE6D6', '#F4F1EA', '#EFEEEA', '#F8F6F0']}
          />
        </TweakSection>
        <TweakSection label="Layout">
          <TweakToggle label="Show AI insight banner" value={tweaks.showInsight} onChange={v => setTweak('showInsight', v)} />
          <TweakToggle label="Compact density" value={tweaks.compact} onChange={v => setTweak('compact', v)} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
