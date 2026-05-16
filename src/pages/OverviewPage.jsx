import { useAppState } from '../app/AppState.jsx';
import {
  AccountsRail,
  BillsCard,
  DebtCard,
  ForecastCard,
  GoalsCard,
  HeroCashflow,
  HeroNetWorth,
  HeroSpend,
  InvestmentsCard,
  KidsCard,
  SpendingCard,
  TransactionsCard,
} from '../sections.jsx';

export function OverviewPage({ onAddAccount, onEditAccount, onEditTransaction, onAdjustBudget }) {
  const {
    chores,
    hidden,
    netWorthRange,
    setNetWorthRange,
    toggleChore,
  } = useAppState();

  return (
    <>
      <div className="grid hero-grid">
        <HeroNetWorth hidden={hidden} range={netWorthRange} setRange={setNetWorthRange} />
        <HeroSpend hidden={hidden} />
        <HeroCashflow hidden={hidden} onAdjustBudget={onAdjustBudget} />
      </div>

      <div className="grid main-grid">
        <AccountsRail hidden={hidden} onAddAccount={onAddAccount} onEditAccount={onEditAccount} />
        <div className="stack">
          <SpendingCard hidden={hidden} onAdjustBudget={onAdjustBudget} />
          <ForecastCard hidden={hidden} />
        </div>
        <GoalsCard hidden={hidden} />
      </div>

      <div className="grid bottom-grid">
        <TransactionsCard hidden={hidden} onEditTransaction={onEditTransaction} />
        <BillsCard hidden={hidden} />
        <div className="stack">
          <InvestmentsCard hidden={hidden} />
          <DebtCard hidden={hidden} />
        </div>
      </div>

      <div className="grid kids-grid">
        <KidsCard hidden={hidden} chores={chores} toggleChore={toggleChore} />
      </div>
    </>
  );
}
