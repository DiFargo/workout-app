import { useState } from "react";
import { getWorkoutPresentation } from "../../../domain/workoutPresentation";
import { sortWorkoutDays } from "../../../utils/workoutPlanNormalization";
import { getBasicWorkoutMicrocycles, getBasicWorkoutSummary } from "../../../utils/basicWorkoutPlanStructure";
import { ClientTrainingBottomBar } from "../../../shared/ui/BottomBar";
import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import adaptiveShellStyles from "../../../shared/ui/ClientAdaptiveShell.module.css";
import styles from "./WorkoutPlanPage.module.css";

function getWorkoutGroupSummary(workout = {}) {
  const groups = (Array.isArray(workout.taskBlocks) ? workout.taskBlocks : [])
    .filter((block) => block?.type === "group" && Array.isArray(block.exerciseIds) && block.exerciseIds.length);

  return groups.map((block) => {
    const rounds = Math.max(1, Number(block.rounds) || 1);
    const roundLabel = rounds === 1 ? "круг" : rounds >= 2 && rounds <= 4 ? "круга" : "кругов";
    return `${block.groupMode === "triset" ? "Трисет" : "Суперсет"} · ${block.exerciseIds.length} упр. · ${rounds} ${roundLabel}`;
  }).join(" · ");
}

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
  const [activeMicrocycleNumber, setActiveMicrocycleNumber] = useState(1);
  const isBasicPlan = plan?.source === "basic";
  const isVariantsThenProgressionPlan = plan?.structure === "variants_then_progression";
  const sortedPlanWorkouts = sortWorkoutDays(plan.workouts || []);
  const basicPlanMicrocycles = isBasicPlan
    ? getBasicWorkoutMicrocycles({ ...plan, workouts: sortedPlanWorkouts })
    : [];
  const activeBasicMicrocycle = basicPlanMicrocycles.find((cycle) => cycle.number === activeMicrocycleNumber)
    || basicPlanMicrocycles[0];
  const completedPlanWorkoutSet = getCompletedWorkoutSet(history);
  const completedPlanWorkoutCount = sortedPlanWorkouts.filter((workoutItem) => (
    isWorkoutCompletedByHistory(workoutItem, completedPlanWorkoutSet)
  )).length;
  const isPlanCompleted = Boolean(
    sortedPlanWorkouts.length > 0 &&
    completedPlanWorkoutCount === sortedPlanWorkouts.length
  );
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
    <div className={`${styles.page} ${adaptiveShellStyles.shell}`} data-client-adaptive-shell="true" data-testid="workout-plan-page" data-css-module-scope="workout-plan">
      <ClientPageHeader
        compact
        className={styles.header}
        title={isBasicPlan ? "Базовый план" : "План тренировок"}
        eyebrow={isBasicPlan ? "Два микроцикла" : "Программа тренера"}
        onBack={onGoBackToMain}
        backAriaLabel="Вернуться назад"
        testId="workout-plan-header"
        scope="workout-plan-header"
      />
      <main className={styles.shell}>
        <p className={styles.planName}>{plan.assignedProgramName || user?.assignedProgramName || "Индивидуальная программа"}</p>

        <section className={styles.stats} data-testid="workout-plan-stats">
          <div><strong>{isBasicPlan ? basicPlanMicrocycles.length : workoutPlanWeeks.length}</strong><span>{isBasicPlan ? "микроцикла" : "недель"}</span></div>
          <div><strong>{sortedPlanWorkouts.length}</strong><span>тренировок</span></div>
          <div><strong>{completedPlanWorkoutCount}</strong><span>выполнено</span></div>
        </section>

        {isPlanCompleted ? (
          <section className={styles.completedPlanNotice} data-testid="workout-plan-completed-notice">
            <strong>План завершён</strong>
            <span>Все тренировки отмечены как выполненные. На следующем экране можно выбрать следующий шаг.</span>
            <button type="button" onClick={onOpenWorkouts}>Открыть тренировки</button>
          </section>
        ) : null}

        <div className={styles.weekList}>
          {isBasicPlan && activeBasicMicrocycle ? (
            <>
              <div className={styles.microcycleTabs} role="tablist" aria-label="Микроциклы базового плана">
                {basicPlanMicrocycles.map((microcycle) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={microcycle.number === activeBasicMicrocycle.number}
                    className={microcycle.number === activeBasicMicrocycle.number ? styles.activeMicrocycleTab : ""}
                    key={microcycle.number}
                    onClick={() => setActiveMicrocycleNumber(microcycle.number)}
                  >
                    {`Микроцикл ${microcycle.number}`}
                  </button>
                ))}
              </div>
              <section className={styles.week} data-testid="workout-plan-week">
                <h2>{activeBasicMicrocycle.label}</h2>
                <div>
                  {activeBasicMicrocycle.items.map(({ workout: workoutItem, index }, dayIndex) => {
                    const completed = isWorkoutCompletedByHistory(workoutItem, completedPlanWorkoutSet);
                    const dayLabel = isVariantsThenProgressionPlan
                      ? [
                        workoutItem.weekLabel || `Неделя ${workoutItem.weekNumber || 1}`,
                        workoutItem.dayLabel || `День ${dayIndex + 1}`
                      ].filter(Boolean).join(" · ")
                      : (workoutItem.dayLabel || `День ${dayIndex + 1}`);

                    return (
                      <button
                        type="button"
                        className={completed ? styles.completed : ""}
                        key={workoutItem.id}
                        onClick={() => onOpenWorkoutIndex(index)}
                      >
                        <span>
                          <small>{dayLabel}</small>
                          <strong>{workoutItem.focus || getWorkoutPresentation(workoutItem, index).title}</strong>
                          <em>{getBasicWorkoutSummary(workoutItem)}</em>
                        </span>
                        <i>{completed ? "✓" : "›"}</i>
                      </button>
                    );
                  })}
                </div>
              </section>
            </>
          ) : workoutPlanWeeks.length ? workoutPlanWeeks.map((week) => (
            <section className={styles.week} data-testid="workout-plan-week" key={week.name}>
              <h2>{week.name}</h2>
              <div>
                {week.items.map(({ workout: workoutItem, presentation, index }) => {
                  const completed = isWorkoutCompletedByHistory(workoutItem, completedPlanWorkoutSet);
                  const groupSummary = getWorkoutGroupSummary(workoutItem);

                  return (
                    <button
                      type="button"
                      className={completed ? styles.completed : ""}
                      key={workoutItem.id}
                      onClick={() => onOpenWorkoutIndex(index)}
                    >
                      <span>
                        <small>{presentation.day}</small>
                        <strong>{presentation.title}</strong>
                        <em>{presentation.exerciseCount} упр. · {presentation.setCount} подходов</em>
                        {groupSummary ? <small className={styles.groupSummary}>{groupSummary}</small> : null}
                      </span>
                      <i>{completed ? "✓" : "›"}</i>
                    </button>
                  );
                })}
              </div>
            </section>
          )) : (
            <div className={styles.empty}>
              <strong>План пока не назначен</strong>
              <span>После назначения тренером здесь появятся недели и тренировки.</span>
            </div>
          )}
        </div>
      </main>

      <div className={styles.bottomPanel} data-testid="workout-plan-bottom-panel">
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
