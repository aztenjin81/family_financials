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

export function OverviewPage() {
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
        <HeroCashflow hidden={hidden} />
      </div>

      <div className="grid main-grid">
        <AccountsRail hidden={hidden} />
        <div className="stack">
          <SpendingCard hidden={hidden} />
          <ForecastCard hidden={hidden} />
        </div>
        <GoalsCard hidden={hidden} />
      </div>

      <div className="grid bottom-grid">
        <TransactionsCard hidden={hidden} />
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
