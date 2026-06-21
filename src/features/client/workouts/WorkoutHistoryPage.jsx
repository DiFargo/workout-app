import { ClientMainBottomBar } from "../../../shared/ui/BottomBar";
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

export default function WorkoutHistoryPage({
  canUseTrainerFeatures,
  history,
  historyLoading,
  openHistoryKey,
  historySwipeId,
  historyDeletingId,
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
  renderHistoryDeleteConfirm
}) {
  const historyItems = getAiHistoryItems(history);
  const totalHistorySets = historyItems.reduce((sum, item) => (
    sum + (item.exercises || []).reduce((exerciseSum, exercise) => exerciseSum + (exercise.sets?.length || 0), 0)
  ), 0);
  const totalHistoryExercises = historyItems.reduce((sum, item) => sum + (item.exercises?.length || 0), 0);
  const latestHistoryWorkout = historyItems[0];

  return (
    <div className="app historyPagePremium historyPageCompact progressHistoryPage">
      <section className="historyCompactHero">
        <div>
          <span>История</span>
          <h1>Тренировки</h1>
          <p>{historyItems.length ? `Последняя: ${formatHistoryCardDate(latestHistoryWorkout?.date, true)}` : "Сохраняй тренировки — здесь будет прогресс."}</p>
        </div>

        <button className="historyRefreshBtn historyCompactRefresh" onClick={loadHistory}>
          🔄
        </button>
      </section>

      <section className="historyCompactStats">
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
        <section className="historyCompactLast">
          <span>Последняя</span>
          <strong>{getHistoryWorkoutParts(latestHistoryWorkout.workout).title}</strong>
          <small>
            {formatHistoryCardDate(latestHistoryWorkout.date)} · {getHistorySetCount(latestHistoryWorkout)} подходов · {getHistoryTopExercise(latestHistoryWorkout)}
          </small>
        </section>
      )}

      {historyLoading && (
        <div className="historyEmptyCard historyCompactEmpty">
          <h3>Загрузка истории...</h3>
        </div>
      )}

      {!historyLoading && historyItems.length === 0 && (
        <div className="historyEmptyCard historyCompactEmpty">
          <h3>История пустая</h3>
          <p>Заверши тренировку, и она появится здесь.</p>
        </div>
      )}

      {!historyLoading && historyItems.length > 0 && (
        <div className="historyCompactList">
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
                className={`${isOpen ? "historyCompactCard open" : "historyCompactCard"}${isSwiped ? " swiped" : ""}`}
                key={item.id}
                onTouchStart={(event) => handleHistoryTouchStart(event, item.id)}
                onTouchEnd={(event) => handleHistoryTouchEnd(event, item)}
              >
                <div className="historySwipeDeleteAction" onClick={() => requestDeleteOwnHistoryWorkout(item)}>
                  {historyDeletingId === item.id ? "Удаляю..." : "Удалить"}
                </div>

                <div className="historyCompactCardInner">
                  <div className="historyCompactCardTop">
                    <button
                      type="button"
                      className="historyCompactMain"
                      onClick={() => setOpenHistoryKey(isOpen ? null : item.id)}
                    >
                      <span>{date}{time ? ` · ${time}` : ""}</span>
                      <strong>{parts.title}</strong>
                      <small>{parts.day} · {exerciseCount} упр. · {setCount} подходов</small>
                    </button>

                    <button
                      type="button"
                      className="historyCompactToggle"
                      onClick={() => setOpenHistoryKey(isOpen ? null : item.id)}
                      aria-label={isOpen ? "Свернуть" : "Развернуть"}
                    >
                      {isOpen ? "⏫" : "⏬"}
                    </button>
                  </div>

                  <div className="historyCompactMeta">
                    <span>{volume > 0 ? `${Math.round(volume)} кг объём` : "объём —"}</span>
                    {item.postWorkoutFeedback?.title && (
                      <span>{item.postWorkoutFeedback.emoji || "💬"} {item.postWorkoutFeedback.title}</span>
                    )}
                  </div>

                  {isOpen && (
                    <div className="historyCompactBody">
                      {(item.exercises || []).map((exercise, index) => (
                        <div className="historyCompactExercise" key={`${exercise.name}_${index}`}>
                          <div className="historyCompactExerciseHead">
                            <strong>{exercise.name}</strong>
                            <span>{exercise.sets?.length || 0} подх.</span>
                          </div>

                          <div className="historyCompactSets">
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

      {renderHistoryDeleteConfirm()}

      <ClientMainBottomBar
        activeTab="workouts"
        isTrainerMode={canUseTrainerFeatures}
        onGoMain={goBackToMain}
        onOpenTraining={openTrainingEntry}
        onOpenNutrition={onOpenNutrition}
        onOpenCabinet={openProfileCabinet}
        onOpenTrainerClients={onOpenTrainerClients}
        onOpenTrainerPrograms={onOpenTrainerPrograms}
        onLoadTrainerCabinet={openProfileCabinet}
      />
    </div>
  );
}

