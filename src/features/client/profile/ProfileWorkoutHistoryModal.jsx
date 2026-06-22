export default function ProfileWorkoutHistoryModal({
  open,
  programScope,
  loading,
  items = [],
  openItemId,
  itemRefs,
  deletingId,
  getTimestampValue,
  onClose,
  onToggleItem,
  onRequestDelete
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="workoutModeModalOverlay" role="presentation" onClick={onClose}>
      <section
        className="workoutModeModal workoutHistoryModal cabinetWorkoutHistoryModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cabinetWorkoutHistoryModalTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="workoutModeModalHeader">
          <div>
            <small>{programScope ? "НАЗНАЧЕННАЯ ПРОГРАММА" : "ЛИЧНЫЙ КАБИНЕТ"}</small>
            <h2 id="cabinetWorkoutHistoryModalTitle">
              {programScope?.assignedProgramName || "История тренировок"}
            </h2>
          </div>
          <button type="button" aria-label="Закрыть историю тренировок" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="workoutHistoryModalList">
          {loading && <p>Загрузка истории...</p>}

          {!loading && items.map((item) => {
            const isOpen = openItemId === item.id;
            const itemDate = getTimestampValue(item.date);

            return (
              <div
                className={`cabinetWorkoutHistoryItem ${isOpen ? "open" : ""}`}
                key={item.id || `${item.date}_${item.workout}`}
                ref={(node) => {
                  if (!itemRefs?.current || !item.id) return;
                  if (node) itemRefs.current.set(item.id, node);
                  else itemRefs.current.delete(item.id);
                }}
              >
                <button
                  type="button"
                  onClick={() => onToggleItem(item.id)}
                  aria-expanded={isOpen}
                >
                  <span aria-hidden="true">{item.postWorkoutFeedback?.emoji || item.readiness?.emoji || "🏋️"}</span>
                  <div>
                    <strong>{item.workout || "Тренировка"}</strong>
                    <small>
                      {itemDate
                        ? new Date(itemDate).toLocaleDateString("ru-RU", {
                            day: "numeric",
                            month: "short",
                            year: "numeric"
                          }).replace(".", "")
                        : "Без даты"}
                      {item.durationSeconds ? ` · ${Math.max(1, Math.round(item.durationSeconds / 60))} мин` : ""}
                    </small>
                  </div>
                  <i>{isOpen ? "⌃" : "›"}</i>
                </button>

                {isOpen && (
                  <div className="cabinetWorkoutHistoryDetails">
                    {(item.exercises || []).map((exercise, index) => (
                      <div className="cabinetWorkoutHistoryExercise" key={`${exercise.name}_${index}`}>
                        <div className="cabinetWorkoutHistoryExerciseHead">
                          <strong>{exercise.name}</strong>
                          <small>{exercise.sets?.length || 0} подходов</small>
                        </div>
                        <div className="cabinetWorkoutHistorySets">
                          {(exercise.sets || []).map((set, setIndex) => (
                            <span key={setIndex}>
                              <b>{set.set || setIndex + 1}</b>
                              {set.reps === "" || set.reps == null ? "—" : set.reps} повт.
                              <i>
                                {set.weight === "" || set.weight == null
                                  ? "без веса"
                                  : `${set.weight} кг`}
                              </i>
                            </span>
                          ))}
                          {!exercise.sets?.length && <small>Подходы не сохранены</small>}
                        </div>
                      </div>
                    ))}
                    {!item.exercises?.length && <p>Данные упражнений не сохранены.</p>}
                    <button
                      type="button"
                      className="cabinetWorkoutHistoryDelete"
                      onClick={() => onRequestDelete(item)}
                      disabled={deletingId === item.id}
                    >
                      {deletingId === item.id ? "Удаляю..." : "Удалить тренировку"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {!loading && items.length === 0 && (
            <p>
              {programScope
                ? "В этой программе завершённых тренировок пока нет."
                : "Завершённые тренировки появятся здесь."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
