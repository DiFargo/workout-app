import { formatIndividualWorkoutHistoryDate } from "../../../utils/workoutHistoryPresentation";

export function WorkoutModePickerDialog({
  open,
  workoutModePreference,
  rememberChoice,
  onClose,
  onOpenBasic,
  onOpenIndividual,
  onRememberChoiceChange
}) {
  if (!open) return null;
  const rememberChecked = Boolean(rememberChoice ?? workoutModePreference?.remember);

  return (
    <div
      className="workoutModeModalOverlay"
      role="presentation"
      onClick={onClose}
    >
      <section
        className="workoutModeModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workoutModeModalTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="workoutModeModalHeader">
          <div>
            <small>ТРЕНИРОВКИ</small>
            <h2 id="workoutModeModalTitle">Режим запуска</h2>
          </div>
          <button
            type="button"
            aria-label="Закрыть выбор режима"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="workoutModeModalOptions">
          <button
            type="button"
            className={workoutModePreference.mode === "basic" ? "active" : ""}
            aria-pressed={workoutModePreference.mode === "basic"}
            onClick={onOpenBasic}
          >
            <span>Б</span>
            <div>
              <strong>Базовые тренировки</strong>
              <small>Подбор готовой программы по цели и опыту</small>
            </div>
            <i>›</i>
          </button>

          <button
            type="button"
            className={workoutModePreference.mode === "individual" ? "active" : ""}
            aria-pressed={workoutModePreference.mode === "individual"}
            onClick={onOpenIndividual}
          >
            <span>И</span>
            <div>
              <strong>Индивидуальный план</strong>
              <small>Программа, назначенная вашим тренером</small>
            </div>
            <i>✓</i>
          </button>
        </div>

        <label className="workoutModeModalRemember">
          <input
            type="checkbox"
            checked={rememberChecked}
            onChange={(event) => onRememberChoiceChange?.(event.target.checked)}
          />
          <span>Запомнить выбор</span>
        </label>
      </section>
    </div>
  );
}

export function IndividualWorkoutHistoryDialog({
  open,
  historyLoading,
  historyItems,
  onClose,
  onOpenAll
}) {
  if (!open) return null;

  return (
    <div
      className="workoutModeModalOverlay"
      role="presentation"
      onClick={onClose}
    >
      <section
        className="workoutModeModal workoutHistoryModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workoutHistoryModalTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="workoutModeModalHeader">
          <div>
            <small>ИНДИВИДУАЛЬНЫЙ ПЛАН</small>
            <h2 id="workoutHistoryModalTitle">История тренировок</h2>
          </div>
          <button
            type="button"
            aria-label="Закрыть историю тренировок"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="workoutHistoryModalList">
          {historyLoading && <p>Загрузка истории...</p>}

          {!historyLoading && historyItems.map((item) => (
            <div
              className="workoutHistoryModalItem"
              key={item.id || `${item.date}_${item.workout}`}
            >
              <span aria-hidden="true">{item.postWorkoutFeedback?.emoji || item.readiness?.emoji || "🏋️"}</span>
              <div>
                <strong>{item.workout || "Тренировка"}</strong>
                <small>
                  {formatIndividualWorkoutHistoryDate(item.date)}
                  {item.durationSeconds ? ` · ${Math.max(1, Math.round(item.durationSeconds / 60))} мин` : ""}
                </small>
              </div>
            </div>
          ))}

          {!historyLoading && historyItems.length === 0 && (
            <p>В этой программе завершённых тренировок пока нет.</p>
          )}
        </div>

        {historyItems.length > 0 && (
          <button
            type="button"
            className="workoutHistoryModalAll"
            onClick={onOpenAll}
          >
            Открыть историю тренировок
          </button>
        )}
      </section>
    </div>
  );
}
