import HistoryDeleteConfirmDialog from "./HistoryDeleteConfirmDialog";
import { RefreshCw } from "lucide-react";
import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import {
  getAiHistoryItems
} from "../../../domain/workoutPresentation";
import {
  formatHistoryCardDate,
  formatHistoryTime,
  getHistorySetCount,
  getHistoryTopExercise,
  getHistoryVolume,
  getHistoryWorkoutParts
} from "../../../utils/workoutHistoryPresentation";
import styles from "./WorkoutHistoryPage.module.css";

export default function WorkoutHistoryPage({
  canUseTrainerFeatures,
  renderClientMainBottomBar,
  history,
  historyLoading,
  openHistoryKey,
  historySwipeId,
  historyDeletingId,
  historyDeleteCandidate,
  goBackToMain,
  openTrainingEntry,
  onOpenNutrition,
  openProfileCabinet,
  onOpenTrainerClients,
  onOpenTrainerPrograms,
  loadHistory,
  handleHistoryTouchStart,
  handleHistoryTouchEnd,
  requestDeleteOwnHistoryWorkout,
  setOpenHistoryKey,
  closeHistoryDeleteConfirm,
  confirmDeleteOwnHistoryWorkout
}) {
  const historyItems = getAiHistoryItems(history);
  const totalHistorySets = historyItems.reduce((sum, item) => (
    sum + (item.exercises || []).reduce((exerciseSum, exercise) => exerciseSum + (exercise.sets?.length || 0), 0)
  ), 0);
  const totalHistoryExercises = historyItems.reduce((sum, item) => sum + (item.exercises?.length || 0), 0);
  const latestHistoryWorkout = historyItems[0];

  return (
    <div className={styles.page} data-testid="workout-history-page" data-css-module-scope="workout-history">
      <ClientPageHeader
        compact
        className={styles.header}
        title="История тренировок"
        titleTestId="workout-history-title"
        testId="workout-history-hero"
        scope="workout-history-header"
        onBack={goBackToMain}
        backAriaLabel="Вернуться назад"
        actions={(
          <button className={styles.refresh} data-testid="workout-history-refresh" type="button" onClick={loadHistory} aria-label="Обновить историю тренировок">
            <RefreshCw aria-hidden="true" />
          </button>
        )}
      />

      <p className={styles.lead}>
        {historyItems.length ? `Последняя: ${formatHistoryCardDate(latestHistoryWorkout?.date, true)}` : "Сохраняй тренировки — здесь будет прогресс."}
      </p>

      <section className={styles.stats} data-testid="workout-history-stats">
        <div>
          <strong>{historyItems.length}</strong>
          <span>трен.</span>
        </div>
        <div>
          <strong>{totalHistorySets}</strong>
          <span>подходов</span>
        </div>
        <div>
          <strong>{totalHistoryExercises}</strong>
          <span>упр.</span>
        </div>
      </section>

      {latestHistoryWorkout && (
        <section className={styles.latest} data-testid="workout-history-latest">
          <span>Последняя</span>
          <strong>{getHistoryWorkoutParts(latestHistoryWorkout.workout).title}</strong>
          <small>
            {formatHistoryCardDate(latestHistoryWorkout.date)} · {getHistorySetCount(latestHistoryWorkout)} подходов · {getHistoryTopExercise(latestHistoryWorkout)}
          </small>
        </section>
      )}

      {historyLoading && (
        <div className={styles.empty} data-testid="workout-history-empty">
          <h3>Загрузка истории...</h3>
        </div>
      )}

      {!historyLoading && historyItems.length === 0 && (
        <div className={styles.empty} data-testid="workout-history-empty">
          <h3>История пустая</h3>
          <p>Заверши тренировку, и она появится здесь.</p>
        </div>
      )}

      {!historyLoading && historyItems.length > 0 && (
        <div className={styles.list} data-testid="workout-history-list">
          {historyItems.map((item) => {
            const isOpen = openHistoryKey === item.id;
            const date = formatHistoryCardDate(item.date);
            const time = formatHistoryTime(item.date);
            const parts = getHistoryWorkoutParts(item.workout);
            const setCount = getHistorySetCount(item);
            const volume = getHistoryVolume(item);
            const exerciseCount = item.exercises?.length || 0;
            const isSwiped = historySwipeId === item.id;

            return (
              <article
                className={[styles.card, isOpen && styles.open, isSwiped && styles.swiped].filter(Boolean).join(" ")}
                data-testid="workout-history-card"
                key={item.id}
                onTouchStart={(event) => handleHistoryTouchStart(event, item.id)}
                onTouchEnd={(event) => handleHistoryTouchEnd(event, item)}
              >
                <div className={styles.deleteAction} data-testid="workout-history-delete-action" onClick={() => requestDeleteOwnHistoryWorkout(item)}>
                  {historyDeletingId === item.id ? "Удаляю..." : "Удалить"}
                </div>

                <div className={styles.cardInner} data-testid="workout-history-card-inner">
                  <div className={styles.cardTop}>
                    <button
                      type="button"
                      className={styles.main}
                      data-testid="workout-history-card-main"
                      onClick={() => setOpenHistoryKey(isOpen ? null : item.id)}
                    >
                      <span>{date}{time ? ` · ${time}` : ""}</span>
                      <strong>{parts.title}</strong>
                      <small>{parts.day} · {exerciseCount} упр. · {setCount} подходов</small>
                    </button>

                    <button
                      type="button"
                      className={styles.toggle}
                      data-testid="workout-history-card-toggle"
                      onClick={() => setOpenHistoryKey(isOpen ? null : item.id)}
                      aria-label={isOpen ? "Свернуть" : "Развернуть"}
                    >
                      {isOpen ? "⏫" : "⏬"}
                    </button>
                  </div>

                  <div className={styles.meta}>
                    <span>{volume > 0 ? `${Math.round(volume)} кг объём` : "объём —"}</span>
                    {item.postWorkoutFeedback?.title && (
                      <span>{item.postWorkoutFeedback.emoji || "💬"} {item.postWorkoutFeedback.title}</span>
                    )}
                  </div>

                  {isOpen && (
                    <div className={styles.body}>
                      {(item.exercises || []).map((exercise, index) => (
                        <div className={styles.exercise} key={`${exercise.name}_${index}`}>
                          <div className={styles.exerciseHead}>
                            <strong>{exercise.name}</strong>
                            <span>{exercise.sets?.length || 0} подх.</span>
                          </div>

                          <div className={styles.sets}>
                            {(exercise.sets || []).map((set, setIndex) => (
                              <span key={setIndex}>
                                {set.set || setIndex + 1}: {set.reps || "—"}×{set.weight || "без веса"}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <HistoryDeleteConfirmDialog
        candidate={historyDeleteCandidate}
        deletingId={historyDeletingId}
        onClose={closeHistoryDeleteConfirm}
        onConfirm={confirmDeleteOwnHistoryWorkout}
      />

      {(renderClientMainBottomBar || (() => null))({
        activeTab: "workouts",
        isTrainerMode: canUseTrainerFeatures,
        onGoMain: goBackToMain,
        onOpenTraining: openTrainingEntry,
        onOpenNutrition,
        onOpenCabinet: openProfileCabinet,
        onOpenTrainerClients,
        onOpenTrainerPrograms,
        onLoadTrainerCabinet: openProfileCabinet
      })}
    </div>
  );
}
