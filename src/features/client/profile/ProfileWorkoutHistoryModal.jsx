import styles from "./ProfileWorkoutHistoryModal.module.css";

export function ProfileWorkoutHistoryContent({
  programScope,
  loading,
  items = [],
  openItemId,
  itemRefs,
  deletingId,
  getTimestampValue,
  onToggleItem,
  onRequestDelete,
  embedded = false
}) {
  return (
    <div
      className={`${styles.list} ${embedded ? styles.embeddedList : ""}`}
      data-testid="profile-workout-history-list"
      data-css-module-scope="profile-workout-history"
    >
      {loading && <p className={styles.message}>Загрузка истории...</p>}

      {!loading && items.map((item) => {
        const isOpen = openItemId === item.id;
        const itemDate = getTimestampValue(item.date);
        const workoutTitle = item.workout || "Тренировка";
        const workoutDateLabel = itemDate
          ? new Date(itemDate).toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "short",
              year: "numeric"
            }).replace(".", "")
          : "Без даты";

        return (
          <div
            className={`${styles.item} ${isOpen ? styles.itemOpen : ""}`}
            data-testid="profile-workout-history-item"
            key={item.id || `${item.date}_${item.workout}`}
            ref={(node) => {
              if (!itemRefs?.current || !item.id) return;
              if (node) itemRefs.current.set(item.id, node);
              else itemRefs.current.delete(item.id);
            }}
          >
            <button
              type="button"
              className={styles.itemButton}
              data-testid="profile-workout-history-toggle"
              onClick={() => onToggleItem(item.id)}
              aria-expanded={isOpen}
              aria-label={`${isOpen ? "Свернуть" : "Развернуть"} тренировку: ${workoutTitle}. ${workoutDateLabel}`}
            >
              <span className={styles.itemIcon} aria-hidden="true">{item.postWorkoutFeedback?.emoji || item.readiness?.emoji || "🏋️"}</span>
              <div className={styles.itemContent}>
                <strong className={styles.itemTitle}>{workoutTitle}</strong>
                <small className={styles.itemMeta}>{workoutDateLabel}{item.durationSeconds ? ` · ${Math.max(1, Math.round(item.durationSeconds / 60))} мин` : ""}</small>
              </div>
              <i className={styles.itemIndicator}>{isOpen ? "⌃" : "›"}</i>
            </button>

            {isOpen && (
              <div className={styles.details}>
                {(item.exercises || []).map((exercise, index) => (
                  <div className={styles.exercise} key={`${exercise.name}_${index}`}>
                    <div className={styles.exerciseHeader}>
                      <strong className={styles.exerciseTitle}>{exercise.name}</strong>
                      <small className={styles.exerciseMeta}>{exercise.sets?.length || 0} подходов</small>
                    </div>
                    <div className={styles.sets}>
                      {(exercise.sets || []).map((set, setIndex) => (
                        <span className={styles.set} key={setIndex}>
                          <b className={styles.setIndex}>{set.set || setIndex + 1}</b>
                          {set.reps === "" || set.reps == null ? "—" : set.reps} повт.
                          <i className={styles.setMeta}>
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
                {!item.exercises?.length && <p className={styles.detailsMessage}>Данные упражнений не сохранены.</p>}
                <button
                  type="button"
                  className={styles.deleteButton}
                  data-testid="profile-workout-history-delete"
                  onClick={() => onRequestDelete(item)}
                  disabled={deletingId === item.id}
                  aria-label={`Удалить тренировку: ${workoutTitle}. ${workoutDateLabel}`}
                >
                  {deletingId === item.id ? "Удаляю..." : "Удалить тренировку"}
                </button>
              </div>
            )}
          </div>
        );
      })}

      {!loading && items.length === 0 && (
        <p className={styles.message}>
          {programScope
            ? "В этой программе завершённых тренировок пока нет."
            : "Завершённые тренировки появятся здесь."}
        </p>
      )}
    </div>
  );
}
