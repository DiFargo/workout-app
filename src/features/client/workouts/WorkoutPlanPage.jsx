import { getWorkoutPresentation } from "../../../domain/workoutPresentation";
import { sortWorkoutDays } from "../../../utils/workoutPlanNormalization";
import { ClientTrainingBottomBar } from "../../../shared/ui/BottomBar";

export default function WorkoutPlanPage({
  plan,
  history,
  user,
  onGoBackToMain,
  onOpenWorkoutIndex,
  onOpenWorkouts,
  onOpenPlan,
  onOpenHistory,
  getCompletedWorkoutSet,
  isWorkoutCompletedByHistory
}) {
  const sortedPlanWorkouts = sortWorkoutDays(plan.workouts || []);
  const completedPlanWorkoutSet = getCompletedWorkoutSet(history);
  const completedPlanWorkoutCount = sortedPlanWorkouts.filter((workoutItem) => (
    isWorkoutCompletedByHistory(workoutItem, completedPlanWorkoutSet)
  )).length;
  const workoutPlanWeeks = sortedPlanWorkouts.reduce((groups, workoutItem, index) => {
    const presentation = getWorkoutPresentation(workoutItem, index);
    const weekName =
      workoutItem.weekName ||
      presentation.day.split("·")[0]?.trim() ||
      "План";
    const currentGroup = groups.find((group) => group.name === weekName);
    const item = { workout: workoutItem, presentation, index };

    if (currentGroup) {
      currentGroup.items.push(item);
    } else {
      groups.push({ name: weekName, items: [item] });
    }

    return groups;
  }, []);

  return (
    <div className="workoutPlanOverviewPage">
      <main className="workoutPlanOverviewShell">
        <header className="workoutPlanOverviewHeader">
          <span>ПРОГРАММА ТРЕНЕРА</span>
          <h1>План тренировок</h1>
          <p>{plan.assignedProgramName || user?.assignedProgramName || "Индивидуальная программа"}</p>
        </header>

        <section className="workoutPlanOverviewStats">
          <div><strong>{workoutPlanWeeks.length}</strong><span>недель</span></div>
          <div><strong>{sortedPlanWorkouts.length}</strong><span>тренировок</span></div>
          <div><strong>{completedPlanWorkoutCount}</strong><span>выполнено</span></div>
        </section>

        <div className="workoutPlanWeekList">
          {workoutPlanWeeks.length ? workoutPlanWeeks.map((week) => (
            <section className="workoutPlanWeek" key={week.name}>
              <h2>{week.name}</h2>
              <div>
                {week.items.map(({ workout: workoutItem, presentation, index }) => {
                  const completed = isWorkoutCompletedByHistory(workoutItem, completedPlanWorkoutSet);

                  return (
                    <button
                      type="button"
                      className={completed ? "completed" : ""}
                      key={workoutItem.id}
                      onClick={() => onOpenWorkoutIndex(index)}
                    >
                      <span>
                        <small>{presentation.day}</small>
                        <strong>{presentation.title}</strong>
                        <em>{presentation.exerciseCount} упр. · {presentation.setCount} подходов</em>
                      </span>
                      <i>{completed ? "✓" : "›"}</i>
                    </button>
                  );
                })}
              </div>
            </section>
          )) : (
            <div className="workoutPlanOverviewEmpty">
              <strong>План пока не назначен</strong>
              <span>После назначения тренером здесь появятся недели и тренировки.</span>
            </div>
          )}
        </div>
      </main>

      <div className="individualWorkoutBottomPanel workoutPlanOverviewBottomPanel">
        <ClientTrainingBottomBar
          activeTab="plan"
          onGoMain={onGoBackToMain}
          onOpenWorkouts={onOpenWorkouts}
          onOpenPlan={onOpenPlan}
          onOpenHistory={onOpenHistory}
        />
      </div>
    </div>
  );
}
