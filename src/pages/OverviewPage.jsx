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

export function OverviewPage({
  onAddAccount,
  onAddBill,
  onAddDebt,
  onAddChore,
  onAddGoal,
  onEditAccount,
  onEditBill,
  onEditDebt,
  onEditGoal,
  onEditInvestment,
  onEditTransaction,
  onAdjustBudget,
  onSetBillStatus,
  onSyncPlaidAccounts,
  onUpdateChore,
  onDeleteChore,
  onOpenTransactions,
  onPayWeeklyAllowance,
  allowanceSaving,
  allowanceError,
}) {
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
        <AccountsRail
          hidden={hidden}
          onAddAccount={onAddAccount}
          onEditAccount={onEditAccount}
          onSyncPlaidAccounts={onSyncPlaidAccounts}
        />
        <div className="stack">
          <SpendingCard hidden={hidden} onAdjustBudget={onAdjustBudget} />
          <ForecastCard hidden={hidden} />
        </div>
        <GoalsCard hidden={hidden} onAddGoal={onAddGoal} onEditGoal={onEditGoal} />
      </div>

      <div className="grid bottom-grid">
        <TransactionsCard hidden={hidden} onEditTransaction={onEditTransaction} onViewAll={onOpenTransactions} />
        <BillsCard
          hidden={hidden}
          onAddBill={onAddBill}
          onEditBill={onEditBill}
          onSetBillStatus={onSetBillStatus}
        />
        <div className="stack">
          <InvestmentsCard hidden={hidden} onEditInvestment={onEditInvestment} />
          <DebtCard hidden={hidden} onAddDebt={onAddDebt} onEditDebt={onEditDebt} />
        </div>
      </div>

      <div className="grid kids-grid">
        <KidsCard
          hidden={hidden}
          chores={chores}
          toggleChore={toggleChore}
          onAddChore={onAddChore}
          onUpdateChore={onUpdateChore}
          onDeleteChore={onDeleteChore}
          onPayWeeklyAllowance={onPayWeeklyAllowance}
          allowanceSaving={allowanceSaving}
          allowanceError={allowanceError}
        />
      </div>
    </>
  );
}
