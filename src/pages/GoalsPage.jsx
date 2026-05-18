import { useMemo } from 'react';
import { useAppState } from '../app/AppState.jsx';
import { Avatar, Icon, MoneyV } from '../components.jsx';
import { GoalsCard } from '../sections.jsx';

function sumGoalField(goals, field) {
  return goals.reduce((total, goal) => total + Number(goal[field] || 0), 0);
}

export function GoalsPage({ onAddGoal, onEditGoal }) {
  const { dashboardData: DATA, hidden } = useAppState();
  const goals = DATA.goals || [];
  const members = DATA.householdMembers || [];

  const goalSummary = useMemo(() => {
    const current = sumGoalField(goals, 'current');
    const target = sumGoalField(goals, 'target');
    const remaining = Math.max(target - current, 0);
    const progress = target > 0 ? current / target : 0;
    const sorted = [...goals].sort((left, right) => {
      const leftProgress = left.target > 0 ? left.current / left.target : 0;
      const rightProgress = right.target > 0 ? right.current / right.target : 0;
      return leftProgress - rightProgress;
    });

    return {
      current,
      target,
      remaining,
      progress,
      nextGoal: sorted[0] || null,
    };
  }, [goals]);

  const ownerRows = useMemo(() => members.map((member) => {
    const memberGoals = goals.filter((goal) => goal.owner === member.slug);
    const current = sumGoalField(memberGoals, 'current');
    const target = sumGoalField(memberGoals, 'target');
    const progress = target > 0 ? current / target : 0;

    return {
      ...member,
      goals: memberGoals,
      current,
      target,
      progress,
    };
  }), [goals, members]);

  return (
    <section className="goals-page">
      <div className="grid goals-page-grid">
        <div className="stack">
          <div className="card goals-summary-card">
            <div className="card-header">
              <div>
                <div className="card-label">Goals</div>
                <div className="card-title" style={{ marginTop: 4 }}>Household <em>savings targets</em></div>
              </div>
              <button className="btn-primary" type="button" onClick={() => onAddGoal?.()}>
                <Icon.Plus size={14} />
                Add goal
              </button>
            </div>

            <div className="goals-summary-grid">
              <div>
                <div className="muted tiny">Saved toward goals</div>
                <div className="goals-summary-value">
                  <MoneyV value={goalSummary.current} hidden={hidden} cents />
                </div>
              </div>
              <div>
                <div className="muted tiny">Goal target</div>
                <div className="goals-summary-value">
                  <MoneyV value={goalSummary.target} hidden={hidden} cents />
                </div>
              </div>
              <div>
                <div className="muted tiny">Remaining</div>
                <div className="goals-summary-value">
                  <MoneyV value={goalSummary.remaining} hidden={hidden} cents />
                </div>
              </div>
              <div>
                <div className="muted tiny">Progress</div>
                <div className="goals-summary-value">{Math.round(goalSummary.progress * 100)}%</div>
              </div>
            </div>

            <div className="goal-bar goals-summary-bar" aria-hidden="true">
              <div
                className="goal-bar-fill"
                style={{
                  width: `${Math.min(goalSummary.progress * 100, 100)}%`,
                  background: 'var(--ink)',
                }}
              />
            </div>

            <div className="muted tiny goals-summary-note">
              {goalSummary.nextGoal ? (
                <>
                  Lowest-progress goal: <strong>{goalSummary.nextGoal.name}</strong>
                </>
              ) : (
                'No goals yet. Start one from the add button.'
              )}
            </div>
          </div>

          <div className="card goals-owner-card">
            <div className="card-header">
              <div>
                <div className="card-label">By owner</div>
                <div className="card-title" style={{ marginTop: 4 }}>Who is funding <em>what</em></div>
              </div>
            </div>

            <div className="goals-owner-list">
              {ownerRows.map((member) => (
                <div className="goal-owner-row" key={member.slug}>
                  <div className="goal-owner-head">
                    <Avatar who={member.slug} size={28} />
                    <div>
                      <div className="goal-owner-name">{member.name}</div>
                      <div className="goal-owner-meta">
                        {member.goals.length.toLocaleString()} {member.goals.length === 1 ? 'goal' : 'goals'}
                      </div>
                    </div>
                  </div>
                  <div className="goal-owner-values">
                    <span><MoneyV value={member.current} hidden={hidden} cents /></span>
                    <span className="muted tiny">of <MoneyV value={member.target} hidden={hidden} cents /> target</span>
                  </div>
                  <div className="goal-bar goal-owner-bar">
                    <div
                      className="goal-bar-fill"
                      style={{
                        width: `${Math.min(member.progress * 100, 100)}%`,
                        background: 'var(--green)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <GoalsCard hidden={hidden} onAddGoal={onAddGoal} onEditGoal={onEditGoal} />
      </div>
    </section>
  );
}
