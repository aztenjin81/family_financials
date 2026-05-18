import { useEffect, useMemo, useState } from 'react';
import { useAppState } from '../app/AppState.jsx';
import { MoneyV } from '../components.jsx';
import { KidsCard } from '../sections.jsx';

function sumKidBalances(kids = []) {
  return kids.reduce((total, kid) => total + Number(kid.balance || 0), 0);
}

export function KidsPage({
  onAddChore,
  onUpdateChore,
  onDeleteChore,
  onPayWeeklyAllowance,
  onVoidLatestAllowance,
  onUpdateWeeklyAllowance,
  allowanceSaving,
  allowanceVoiding,
  allowanceError,
}) {
  const { dashboardData: DATA, hidden } = useAppState();
  const kids = DATA.kids || [];
  const allowance = DATA.allowance || { weeklyAmount: 5 };
  const history = DATA.allowanceHistory || [];
  const [weeklyAllowance, setWeeklyAllowance] = useState(String(allowance.weeklyAmount || 5));
  const [saveState, setSaveState] = useState({ saving: false, error: '' });

  const summary = useMemo(() => ({
    balance: sumKidBalances(kids),
    childCount: kids.length,
    batchCount: history.length,
    latest: history[0] || null,
  }), [history, kids]);

  useEffect(() => {
    setWeeklyAllowance(String(allowance.weeklyAmount || 5));
  }, [allowance.weeklyAmount]);

  async function handleSubmitAllowance(event) {
    event.preventDefault();
    setSaveState({ saving: true, error: '' });

    try {
      await onUpdateWeeklyAllowance?.(Number(weeklyAllowance));
    } catch (error) {
      setSaveState({ saving: false, error: error.message });
      return;
    }

    setSaveState({ saving: false, error: '' });
  }

  return (
    <section className="kids-page">
      <div className="card kids-page-summary">
        <div className="card-header">
          <div>
            <div className="card-label">Kids</div>
            <div className="card-title" style={{ marginTop: 4 }}>Allowance <em>center</em></div>
          </div>
          <span className="tag ok">Weekly payout live</span>
        </div>

        <div className="kids-page-summary-grid">
          <div>
            <div className="muted tiny">Kid balances total</div>
            <div className="kids-page-summary-value">
              <MoneyV value={summary.balance} hidden={hidden} cents />
            </div>
          </div>
          <div>
            <div className="muted tiny">Weekly allowance</div>
            <div className="kids-page-summary-value">
              <MoneyV value={allowance.weeklyAmount || 0} hidden={hidden} cents />
            </div>
          </div>
          <div>
            <div className="muted tiny">Recorded batches</div>
            <div className="kids-page-summary-value">{summary.batchCount.toLocaleString()}</div>
          </div>
          <div>
            <div className="muted tiny">Children included</div>
            <div className="kids-page-summary-value">{summary.childCount.toLocaleString()}</div>
          </div>
        </div>

        <div className="divider" />
        <div className="kids-page-summary-footer">
          <div className="muted tiny">
            {summary.latest ? (
              <>
                Last payout: <strong>{summary.latest.label}</strong> for <MoneyV value={summary.latest.total} hidden={hidden} cents />
              </>
            ) : (
              'No allowance payouts have been recorded yet.'
            )}
          </div>
          {allowanceError ? <span className="tag alert">{allowanceError}</span> : null}
        </div>

        <form className="kids-allowance-form" onSubmit={handleSubmitAllowance}>
          <label className="form-field kids-allowance-field">
            <span>Weekly allowance amount</span>
            <input
              min="0.01"
              step="0.01"
              type="number"
              value={weeklyAllowance}
              onChange={(event) => setWeeklyAllowance(event.target.value)}
            />
          </label>
          <div className="kids-allowance-form-actions">
            <button className="btn-primary" type="submit" disabled={saveState.saving}>
              {saveState.saving ? 'Saving...' : 'Update allowance'}
            </button>
          </div>
          {saveState.error ? <div className="tag alert">{saveState.error}</div> : null}
        </form>
      </div>

      <KidsCard
        hidden={hidden}
        onAddChore={onAddChore}
        onUpdateChore={onUpdateChore}
        onDeleteChore={onDeleteChore}
        onPayWeeklyAllowance={onPayWeeklyAllowance}
        onVoidLatestAllowance={onVoidLatestAllowance}
        allowanceSaving={allowanceSaving}
        allowanceVoiding={allowanceVoiding}
        allowanceError={allowanceError}
      />
    </section>
  );
}
