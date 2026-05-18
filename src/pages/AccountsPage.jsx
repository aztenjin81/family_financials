import { useMemo, useRef, useState } from 'react';
import { useAppState } from '../app/AppState.jsx';
import { Icon, MoneyV } from '../components.jsx';
import {
  countDashboardAccounts,
  countLinkedPlaidItems,
  formatAccountCount,
  formatAccountSyncAge,
  formatPlaidItemCount,
  getSpendableBalance,
} from '../lib/accounts.js';
import { requestJson } from '../lib/api.js';

const PLAID_SCRIPT_SRC = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';

let plaidScriptPromise = null;

function loadPlaidScript() {
  if (globalThis.Plaid) {
    return Promise.resolve();
  }

  if (!plaidScriptPromise) {
    plaidScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${PLAID_SCRIPT_SRC}"]`);

      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Plaid Link failed to load')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = PLAID_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        plaidScriptPromise = null;
        reject(new Error('Plaid Link failed to load'));
      };
      document.head.appendChild(script);
    });
  }

  return plaidScriptPromise;
}

function rowToPreviewForm(row, index, householdMembers) {
  const matchingMember = householdMembers.find((member) => member.slug === row.ownerSlug);

  return {
    ...row,
    id: `${row.externalAccountId}-${index}`,
    selected: true,
    ownerSlug: matchingMember?.slug || row.ownerSlug || 'john',
    accountGroup: row.accountGroup || 'Cash',
    icon: row.icon || 'Bank',
  };
}

function buildGroupedAccounts(accounts = []) {
  const groups = new Map();

  for (const account of accounts) {
    const group = account.accountGroup || 'Cash';
    if (!groups.has(group)) {
      groups.set(group, []);
    }

    groups.get(group).push(account);
  }

  return [...groups.entries()].map(([group, items]) => ({ group, items }));
}

export function AccountsPage({ onEditAccount }) {
  const {
    dashboardData: DATA,
    hidden,
    refreshDashboard,
  } = useAppState();
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [plaidConnection, setPlaidConnection] = useState(null);
  const [reviewAccounts, setReviewAccounts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState('');
  const plaidHandlerRef = useRef(null);
  const householdMembers = DATA.householdMembers || [];

  const accountCount = countDashboardAccounts(DATA);
  const linkedPlaidItemCount = countLinkedPlaidItems(DATA);
  const syncAge = formatAccountSyncAge(DATA);
  const defaultOwnerSlug = householdMembers[0]?.slug || 'john';
  const accountGroupOptions = useMemo(
    () => [...new Set(DATA.accounts.map((group) => group.group))].sort((left, right) => left.localeCompare(right)),
    [DATA.accounts],
  );
  const groupedAccounts = useMemo(() => buildGroupedAccounts(DATA.accounts.flatMap((group) => group.items || [])), [DATA.accounts]);
  const plaidAccounts = useMemo(
    () => DATA.accounts.flatMap((group) => group.items || []).filter((account) => account.externalProvider === 'plaid'),
    [DATA.accounts],
  );
  const plaidItemsNeedingAttention = useMemo(() => {
    const seen = new Set();
    const items = [];

    for (const account of plaidAccounts) {
      if (!account.syncStatus || account.syncStatus === 'synced' || seen.has(account.externalItemId)) {
        continue;
      }

      seen.add(account.externalItemId);
      items.push(account);
    }

    return items;
  }, [plaidAccounts]);

  async function openPlaidSession({ token, onSuccess }) {
    await loadPlaidScript();

    plaidHandlerRef.current?.destroy?.();
    plaidHandlerRef.current = globalThis.Plaid.create({
      token,
      onSuccess,
      onExit: (linkError) => {
        if (linkError) {
          setError(linkError.display_message || linkError.error_message || linkError.message || 'Plaid Link exited');
        }
        setStatus('idle');
      },
    });

    plaidHandlerRef.current.open();
  }

  function updateReviewAccount(accountId, field, value) {
    setReviewAccounts((current) => current.map((account) => (
      account.id === accountId ? { ...account, [field]: value } : account
    )));
  }

  async function startPlaidLink() {
    setError('');
    setSyncNote('');
    setStatus('loading');

    try {
      const { linkToken } = await requestJson('/api/plaid/link-token', { method: 'POST' });
      await openPlaidSession({
        token: linkToken,
        onSuccess: async (publicToken, metadata) => {
          setStatus('review');
          try {
            const result = await requestJson('/api/plaid/exchange', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                publicToken,
                selectedAccountIds: (metadata.accounts || []).map((account) => account.id),
                ownerSlug: defaultOwnerSlug,
                institutionName: metadata.institution?.name || '',
                linkSessionId: metadata.link_session_id || '',
              }),
            });

            setPlaidConnection(result.connection);
            setReviewAccounts(result.accounts.map((account, index) => rowToPreviewForm(account, index, householdMembers)));
            setStatus('review');
          } catch (exchangeError) {
            setError(exchangeError.message);
            setStatus('idle');
          }
        },
      });

      setStatus('opening');
    } catch (linkError) {
      setError(linkError.message);
      setStatus('idle');
    }
  }

  async function startPlaidUpdate(itemId) {
    if (!itemId) {
      setError('Plaid item ID is required.');
      return;
    }

    setError('');
    setSyncNote('');
    setStatus('updating');

    try {
      const { linkToken } = await requestJson('/api/plaid/update-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      });

      await openPlaidSession({
        token: linkToken,
        onSuccess: async () => {
          try {
            await syncPlaidAccounts(itemId);
            const result = await requestJson('/api/plaid/review', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ itemId }),
            });

            if (result.accounts.length) {
              setPlaidConnection(result.connection);
              setReviewAccounts(result.accounts.map((account, index) => rowToPreviewForm(account, index, householdMembers)));
              setSyncNote(`${result.accounts.length} new ${result.accounts.length === 1 ? 'account' : 'accounts'} ready to import.`);
              setStatus('review');
            } else {
              setSyncNote('Plaid item updated and refreshed.');
              setStatus('idle');
            }
          } catch (updateError) {
            setError(updateError.message);
            setStatus('idle');
          }
        },
      });

      setStatus('opening');
    } catch (updateError) {
      setError(updateError.message);
      setStatus('idle');
    }
  }

  async function importSelectedAccounts() {
    const selectedAccounts = reviewAccounts.filter((account) => account.selected);

    if (!selectedAccounts.length) {
      setError('Select at least one account to import.');
      return;
    }

    setError('');
    setSaving(true);

    try {
      for (const account of selectedAccounts) {
        await requestJson('/api/accounts/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: 'plaid',
            externalItemId: account.externalItemId,
            externalAccountId: account.externalAccountId,
            accountGroup: account.accountGroup,
            name: account.name,
            subtitle: account.subtitle,
            icon: account.icon,
            balance: account.balance,
            ownerSlug: account.ownerSlug,
          }),
        });
      }

      await refreshDashboard();
      setReviewAccounts([]);
      setPlaidConnection(null);
      setStatus('idle');
      setSyncNote('');
    } catch (importError) {
      setError(importError.message);
    } finally {
      setSaving(false);
    }
  }

  async function syncPlaidAccounts(itemId = null) {
    if (!plaidAccounts.length) {
      setError('No Plaid-linked accounts are available to sync.');
      return;
    }

    setError('');
    setSyncing(true);

    try {
      const result = await requestJson('/api/plaid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemId ? { itemId } : {}),
      });
      await refreshDashboard();

      const accountsLabel = result.accountsUpdated === 1 ? 'account' : 'accounts';
      const itemsLabel = result.itemsSynced === 1 ? 'item' : 'items';
      setSyncNote(`Synced ${result.accountsUpdated} ${accountsLabel} from ${result.itemsSynced} Plaid ${itemsLabel}.`);
    } catch (syncError) {
      setError(syncError.message);
    } finally {
      setSyncing(false);
    }
  }

  const pendingCount = reviewAccounts.filter((account) => account.selected).length;

  return (
    <section className="accounts-page">
      <div className="grid accounts-page-grid">
        <div className="card accounts-intro">
          <div className="card-header">
            <div>
              <div className="card-label">Accounts</div>
              <div className="card-title" style={{ marginTop: 4 }}>Connect Plaid, then import balances, bills, and debt payoff details</div>
            </div>
            <span className="tag ok">Server-side tokens</span>
          </div>
          <p className="accounts-copy">
            Plaid Link opens securely in the browser, the access token stays on the server, and you choose
            which accounts to import before they become household accounts. Credit-card liabilities can also
            populate bills and debt payoff details automatically.
          </p>
          <div className={`accounts-summary ${accountCount === 0 ? 'accounts-summary--empty' : ''}`}>
            <div>
              <div className="muted tiny">Accounts</div>
              <div className="transactions-summary-value">{formatAccountCount(accountCount)}</div>
            </div>
            <div>
              <div className="muted tiny">Linked Plaid items</div>
              <div className="transactions-summary-value">{formatPlaidItemCount(linkedPlaidItemCount)}</div>
            </div>
            <div>
              <div className="muted tiny">Last sync</div>
              <div className="transactions-summary-value">
                {syncAge === 'never synced' ? 'Unavailable' : syncAge}
              </div>
            </div>
          </div>
          {accountCount === 0 && (
            <div className="accounts-summary-note muted tiny">
              Until you import the first Plaid accounts, this card stays intentionally light.
            </div>
          )}
          <div className="accounts-actions">
            <button className="btn-primary" type="button" onClick={startPlaidLink} disabled={status === 'loading' || status === 'opening' || status === 'updating'}>
              {status === 'loading' || status === 'opening' ? 'Opening Plaid...' : 'Connect with Plaid'}
            </button>
            <button
              className="btn-ghost"
              type="button"
              onClick={syncPlaidAccounts}
              disabled={syncing || status === 'loading' || status === 'opening' || status === 'updating' || !plaidAccounts.length}
            >
              {syncing ? 'Syncing Plaid...' : 'Sync Plaid accounts'}
            </button>
            <span className="muted tiny">Choose one or more accounts in Link, then review the mapping here.</span>
          </div>
          {plaidItemsNeedingAttention.length > 0 && (
            <div className="accounts-reconnect">
              <div className="muted tiny">Reconnect items flagged by Plaid</div>
              <div className="accounts-reconnect-list">
                {plaidItemsNeedingAttention.map((account) => (
                  <button
                    key={account.externalItemId}
                    className="btn-ghost"
                    type="button"
                    onClick={() => startPlaidUpdate(account.externalItemId)}
                    disabled={status === 'loading' || status === 'opening' || status === 'updating'}
                  >
                    Reconnect {account.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {syncNote && <div className="muted tiny" style={{ marginTop: 12 }}>{syncNote}</div>}
          {error && <div className="form-error" style={{ marginTop: 16 }}>{error}</div>}
        </div>

        <div className="card accounts-linked">
          <div className="card-header">
            <div>
              <div className="card-label">Current household</div>
              <div className="card-title" style={{ marginTop: 4 }}>Imported household accounts</div>
            </div>
            <span className={plaidItemsNeedingAttention.length ? 'tag warn' : 'muted tiny'}>
              {plaidItemsNeedingAttention.length
                ? `${plaidItemsNeedingAttention.length} need attention`
                : `${plaidAccounts.length} Plaid-linked`}
            </span>
          </div>
          {groupedAccounts.length ? (
            groupedAccounts.map((group) => (
              <div key={group.group} className="accounts-group">
                <div className="section-head">
                  <h4>{group.group}</h4>
                  <span className="muted tiny">{group.items.length}</span>
                </div>
                <div className="acct-list">
                  {group.items.map((account) => {
                    const iconName = account.icon || 'Bank';
                    const IconComponent = Icon[iconName] || Icon.Bank;
                    const currentBalance = Number(account.bal || 0);
                    const spendableBalance = getSpendableBalance(account, DATA);
                    const pendingDelta = Math.round((spendableBalance - currentBalance) * 100) / 100;
                    const showSpendable = account.externalProvider === 'plaid';

                    return (
                      <div className="acct" key={account.id ?? account.name}>
                        <button
                          className="acct-icon acct-edit"
                          type="button"
                          title={`Edit ${account.name}`}
                          aria-label={`Edit ${account.name}`}
                          onClick={() => onEditAccount?.(account)}
                        >
                          <IconComponent />
                        </button>
                        <div>
                          <div className="acct-name">{account.name}</div>
                          <div className="acct-sub">{account.sub}</div>
                        </div>
                        <div className="acct-bal-stack">
                          {showSpendable ? (
                            <div className={`acct-bal acct-bal-primary ${spendableBalance < 0 ? 'neg' : ''}`}>
                              <span className="acct-bal-label">Spendable</span>
                              <MoneyV value={spendableBalance} hidden={hidden} cents forceSign={spendableBalance < 0} />
                            </div>
                          ) : (
                            <div className={`acct-bal ${currentBalance < 0 ? 'neg' : ''}`}>
                              <MoneyV value={currentBalance} hidden={hidden} forceSign={currentBalance < 0} />
                            </div>
                          )}
                          {showSpendable && (
                            <div className="acct-bal-sub muted tiny">
                              <span>Current</span>
                              <MoneyV value={currentBalance} hidden={hidden} cents />
                            </div>
                          )}
                          {showSpendable && pendingDelta !== 0 && (
                            <div className={`acct-bal-sub tiny ${pendingDelta < 0 ? 'neg' : ''}`}>
                              <span>Pending</span>
                              <MoneyV value={pendingDelta} hidden={hidden} cents forceSign />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="accounts-empty-panel">
              <div className="accounts-empty-icon" aria-hidden="true">
                <Icon.Bank size={18} />
              </div>
              <div>
                <div className="accounts-empty-title">No accounts imported yet</div>
                <div className="accounts-empty-copy">
                  Connect Plaid to pull in balances, bills, debt payoff details, ownership, and sync status for the household.
                </div>
              </div>
              <button className="btn-primary accounts-empty-action" type="button" onClick={startPlaidLink}>
                Connect with Plaid
              </button>
            </div>
          )}
        </div>
      </div>

      {plaidConnection && (
        <div className="card accounts-review">
          <div className="card-header">
            <div>
              <div className="card-label">Plaid review</div>
              <div className="card-title" style={{ marginTop: 4 }}>
                {plaidConnection.institutionName || 'Connected item'} · {pendingCount} selected
              </div>
            </div>
            <span className="muted tiny">{plaidConnection.syncStatus}</span>
          </div>

          <div className="accounts-review-list">
            {reviewAccounts.map((account) => {
              const iconOptions = ['Bank', 'Vault', 'Card', 'Home', 'Stock', 'Car'];
              return (
                <div className="accounts-review-row" key={account.id}>
                  <label className="form-check accounts-review-check">
                    <input
                      type="checkbox"
                      checked={account.selected}
                      onChange={(event) => updateReviewAccount(account.id, 'selected', event.target.checked)}
                    />
                    <span>{account.name}</span>
                  </label>
                  <label className="form-field">
                    <span>Owner</span>
                    <select
                      value={account.ownerSlug}
                      onChange={(event) => updateReviewAccount(account.id, 'ownerSlug', event.target.value)}
                    >
                      {householdMembers.map((member) => (
                        <option key={member.slug} value={member.slug}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Group</span>
                    <input
                      list="plaid-groups"
                      value={account.accountGroup}
                      onChange={(event) => updateReviewAccount(account.id, 'accountGroup', event.target.value)}
                    />
                  </label>
                  <label className="form-field">
                    <span>Icon</span>
                    <select
                      value={account.icon}
                      onChange={(event) => updateReviewAccount(account.id, 'icon', event.target.value)}
                    >
                      {iconOptions.map((icon) => (
                        <option key={icon} value={icon}>
                          {icon}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="accounts-review-meta">
                    <div className="muted tiny">{account.subtitle || 'No subtitle'}</div>
                    {(() => {
                      const currentBalance = Number(account.balance || 0);
                      const spendableBalance = getSpendableBalance(account, DATA);
                      const pendingDelta = Math.round((spendableBalance - currentBalance) * 100) / 100;

                      return (
                    <div className="accounts-review-balance-stack">
                        <div className={`accounts-review-balance-main ${spendableBalance < 0 ? 'neg' : ''}`}>
                        <span className="accounts-review-balance-label">Spendable</span>
                        <MoneyV
                              value={spendableBalance}
                          hidden={hidden}
                          cents
                          forceSign={spendableBalance < 0}
                        />
                      </div>
                      <div className="accounts-review-balance-sub muted tiny">
                        <span>Current</span>
                            <MoneyV value={currentBalance} hidden={hidden} cents />
                      </div>
                        {pendingDelta !== 0 && (
                          <div className={`accounts-review-balance-sub tiny ${pendingDelta < 0 ? 'neg' : ''}`}>
                            <span>Pending</span>
                            <MoneyV value={pendingDelta} hidden={hidden} cents forceSign />
                          </div>
                        )}
                    </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
            <datalist id="plaid-groups">
              {accountGroupOptions.map((group) => (
                <option key={group} value={group} />
              ))}
            </datalist>
          </div>

          <div className="accounts-review-actions">
            <button className="btn-ghost" type="button" onClick={() => setReviewAccounts([])} disabled={saving}>
              Clear review
            </button>
            <button className="btn-primary" type="button" onClick={importSelectedAccounts} disabled={saving || !pendingCount}>
              {saving ? 'Importing...' : 'Import selected accounts'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
