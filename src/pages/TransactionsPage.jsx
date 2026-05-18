import { Fragment, useMemo, useState } from 'react';
import { useAppState } from '../app/AppState.jsx';
import { Icon, MemberDot, MoneyV } from '../components.jsx';
import { buildTransactionCategoryOptions, filterTransactionRows } from '../lib/transactions.js';

function groupTransactionRows(rows) {
  const groups = [];
  const indexByKey = new Map();

  for (const row of rows) {
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
}

export function TransactionsPage({ onAddTransaction, onEditTransaction }) {
  const {
    dashboardData: DATA,
    dashboardSource,
    deleteTransaction,
    hidden,
    setActivePage,
  } = useAppState();
  const [filters, setFilters] = useState({
    memberSlug: '',
    category: '',
    merchant: '',
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: '',
  });

  const memberOptions = DATA.householdMembers || [];
  const categoryOptions = useMemo(
    () => buildTransactionCategoryOptions(DATA),
    [DATA.spending, DATA.transactions],
  );
  const filteredRows = useMemo(
    () => filterTransactionRows(DATA.transactions, filters, DATA.asOfDate),
    [DATA.transactions, DATA.asOfDate, filters],
  );
  const groupedRows = useMemo(() => groupTransactionRows(filteredRows), [filteredRows]);
  const total = filteredRows.reduce((sum, row) => sum + Number(row.amt || 0), 0);
  const incomeTotal = filteredRows.filter((row) => row.amt > 0).reduce((sum, row) => sum + Number(row.amt || 0), 0);
  const expenseTotal = filteredRows.filter((row) => row.amt < 0).reduce((sum, row) => sum + Number(row.amt || 0), 0);
  const filtersActive = Object.values(filters).some(Boolean);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function clearFilters() {
    setFilters({
      memberSlug: '',
      category: '',
      merchant: '',
      dateFrom: '',
      dateTo: '',
      amountMin: '',
      amountMax: '',
    });
  }

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
    <section className="transactions-page">
      <div className="card transactions-hero">
        <div className="card-header">
          <div>
            <div className="card-label">Transactions</div>
            <div className="card-title" style={{ marginTop: 4 }}>Full household <em>ledger</em></div>
          </div>
          <div className="transactions-actions">
            <button className="btn-ghost" type="button" onClick={() => setActivePage('overview')}>
              Back to overview
            </button>
            <button className="btn-primary" type="button" onClick={() => onAddTransaction?.()}>
              <Icon.Plus size={14} />
              Add transaction
            </button>
          </div>
        </div>
        <div className="transactions-summary">
          <div>
            <div className="muted tiny">Matching transactions</div>
            <div className="transactions-summary-value">{filteredRows.length.toLocaleString()}</div>
          </div>
          <div>
            <div className="muted tiny">Net total</div>
            <div className="transactions-summary-value">
              <MoneyV value={total} size="med" hidden={hidden} forceSign />
            </div>
          </div>
          <div>
            <div className="muted tiny">Income / expense</div>
            <div className="transactions-summary-value transactions-summary-stack">
              <span className="transactions-income"><MoneyV value={incomeTotal} size="sm" hidden={hidden} forceSign /></span>
              <span className="transactions-expense"><MoneyV value={expenseTotal} size="sm" hidden={hidden} forceSign /></span>
            </div>
          </div>
        </div>
      </div>

      <div className="card transactions-filters">
        <div className="card-header">
          <div>
            <div className="card-label">Filters</div>
            <div className="card-title" style={{ marginTop: 4 }}>Member, category, merchant, date, amount</div>
          </div>
          <button className="btn-ghost" type="button" onClick={clearFilters} disabled={!filtersActive}>
            Clear filters
          </button>
        </div>

        <div className="form-grid transactions-filter-grid">
          <label className="form-field">
            <span>Member</span>
            <select value={filters.memberSlug} onChange={(event) => updateFilter('memberSlug', event.target.value)}>
              <option value="">All members</option>
              {memberOptions.map((member) => (
                <option key={member.slug} value={member.slug}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Category</span>
            <select value={filters.category} onChange={(event) => updateFilter('category', event.target.value)}>
              <option value="">All categories</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Merchant</span>
            <input
              value={filters.merchant}
              onChange={(event) => updateFilter('merchant', event.target.value)}
              placeholder="Whole Foods"
            />
          </label>
          <label className="form-field">
            <span>Date from</span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => updateFilter('dateFrom', event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Date to</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) => updateFilter('dateTo', event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Amount min</span>
            <input
              min="0"
              step="0.01"
              type="number"
              value={filters.amountMin}
              onChange={(event) => updateFilter('amountMin', event.target.value)}
              placeholder="0.00"
            />
          </label>
          <label className="form-field">
            <span>Amount max</span>
            <input
              min="0"
              step="0.01"
              type="number"
              value={filters.amountMax}
              onChange={(event) => updateFilter('amountMax', event.target.value)}
              placeholder="250.00"
            />
          </label>
        </div>
      </div>

      <div className="card transactions-results">
        <div className="card-header">
          <div>
            <div className="card-label">Results</div>
            <div className="card-title" style={{ marginTop: 4 }}>
              {groupedRows.length ? `${groupedRows.length} day${groupedRows.length === 1 ? '' : 's'} matched` : 'No matching transactions'}
            </div>
          </div>
          <span className="muted tiny">{filteredRows.length ? 'Sorted newest first' : 'Try widening the filters'}</span>
        </div>

        {groupedRows.length ? (
          <div className="txn-list">
            {groupedRows.map((group) => (
              <Fragment key={group.key}>
                  <div className="txn-day">
                    <span>{group.dayLabel}</span>
                    <span>
                    <MoneyV value={group.items.reduce((sum, item) => sum + Number(item.amt || 0), 0)} hidden={hidden} forceSign />
                    </span>
                  </div>
                {group.items.map((transaction) => (
                  <div className="txn" key={transaction.id ?? `${transaction.date}-${transaction.merch}-${transaction.itemIndex}`}>
                    <div className="txn-emoji">{transaction.emoji}</div>
                    <div>
                      <div className="txn-merch">{transaction.merch}</div>
                      <div className="txn-meta">
                        <span>{transaction.cat}</span>
                        <span>·</span>
                        <span>{transaction.time}</span>
                        <span>·</span>
                        <MemberDot who={transaction.who} />
                        {transaction.syncStatus === 'pending' && <span className="tag warn">Pending</span>}
                      </div>
                      {transaction.syncStatus === 'pending' && transaction.externalProvider === 'plaid' && (
                        <div className="txn-pending-note muted tiny">
                          Affects spendable balance by <MoneyV value={transaction.amt} hidden={hidden} cents forceSign />
                        </div>
                      )}
                    </div>
                    <div className="txn-actions">
                      <div className={`txn-amt ${transaction.income ? 'income' : ''}`}>
                        <MoneyV value={transaction.amt} hidden={hidden} forceSign={!transaction.income} cents />
                      </div>
                      {dashboardSource === 'database' && transaction.id && (
                        <>
                          <button
                            className="icon-btn txn-edit"
                            type="button"
                            title={`Edit ${transaction.merch}`}
                            aria-label={`Edit ${transaction.merch}`}
                            onClick={() => onEditTransaction?.({
                              ...transaction,
                              postedLabel: group.dayLabel,
                              postedDate: transaction.date,
                            })}
                          >
                            ✎
                          </button>
                          <button
                            className="icon-btn txn-delete"
                            type="button"
                            title={`Delete ${transaction.merch}`}
                            aria-label={`Delete ${transaction.merch}`}
                            onClick={() => handleDeleteTransaction(transaction)}
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
        ) : (
          <div className="transactions-empty">
            No transactions match the current filters.
          </div>
        )}
      </div>
    </section>
  );
}
