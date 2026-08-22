import { createPortal } from "react-dom";
import styles from "./WorkoutExerciseModals.module.css";

export default function WorkoutExerciseModals({
  alternativeSource = "basic",
  alternatives = [],
  exercise,
  noteOpen,
  onCloseNote,
  onCloseSwap,
  onCloseTechnique,
  onSelectAlternative,
  onUpdateNote,
  swapOpen,
  techniqueHint,
  techniqueOpen
}) {
  if (!exercise || exercise.id === "warmup") {
    return null;
  }

  const alternativesGroupLabel = alternatives[0]?.groupLabel || "";

  return (
    <>
      {noteOpen && createPortal(
        <div
          className={styles.overlay}
          data-testid="workout-exercise-note-modal"
          data-css-module-scope="workout-exercise-modals"
          role="presentation"
          onClick={onCloseNote}
          onTouchStart={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
          onTouchEnd={(event) => event.stopPropagation()}
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            data-modal-surface="true"
            aria-labelledby="workoutExerciseNoteTitle"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <small>{exercise.name}</small>
                <h2 id="workoutExerciseNoteTitle">Заметка тренеру</h2>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                data-css-module-control="workout-exercise-modals"
                onClick={onCloseNote}
                aria-label="Закрыть заметку тренеру"
              >
                ×
              </button>
            </header>
            <textarea
              className={styles.textarea}
              value={exercise.clientNote || ""}
              onChange={(event) => onUpdateNote(exercise.id, event.target.value)}
              placeholder="Например: уменьшить вес или проверить положение локтей"
              maxLength={240}
            />
            <button
              type="button"
              className={styles.doneButton}
              data-css-module-control="workout-exercise-modals"
              onClick={onCloseNote}
            >
              Готово
            </button>
          </section>
        </div>,
        document.body
      )}

      {swapOpen && createPortal(
        <div
          className={styles.overlay}
          data-testid="basic-workout-exercise-swap-modal"
          data-css-module-scope="workout-exercise-modals"
          role="presentation"
          onClick={onCloseSwap}
          onTouchStart={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
          onTouchEnd={(event) => event.stopPropagation()}
        >
          <section
            className={`${styles.modal} ${styles.swapModal}`}
            role="dialog"
            aria-modal="true"
            data-modal-surface="true"
            aria-labelledby="basicWorkoutSwapTitle"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <small>Вместо: {exercise.name}</small>
                <h2 id="basicWorkoutSwapTitle">Заменить упражнение</h2>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                data-css-module-control="workout-exercise-modals"
                onClick={onCloseSwap}
                aria-label="Закрыть выбор альтернативы"
              >
                ×
              </button>
            </header>
            <p className={styles.swapHint}>
              {alternativeSource === "trainer"
                ? "Тренер назначил эти варианты для замены. Подходы и повторы сохранятся."
                : <>{alternativesGroupLabel ? `Похожие упражнения: ${alternativesGroupLabel}. ` : ""}Подходы и повторы сохранятся.</>}
            </p>
            <div className={styles.alternativeList}>
              {alternatives.map((alternative) => (
                <button
                  key={alternative.id || alternative.name}
                  type="button"
                  className={styles.alternativeButton}
                  data-testid="basic-workout-exercise-alternative"
                  onClick={() => onSelectAlternative?.(alternative)}
                >
                  <span>
                    <strong>{alternative.name}</strong>
                    <small>{alternative.equipment || "Без дополнительного инвентаря"}</small>
                  </span>
                  <b>Выбрать</b>
                </button>
              ))}
            </div>
          </section>
        </div>,
        document.body
      )}

      {techniqueOpen && createPortal(
        <div
          className={styles.overlay}
          data-testid="workout-exercise-technique-modal"
          data-css-module-scope="workout-exercise-modals"
          role="presentation"
          onClick={onCloseTechnique}
          onTouchStart={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
          onTouchEnd={(event) => event.stopPropagation()}
        >
          <section
            className={`${styles.modal} ${styles.techniqueModal}`}
            role="dialog"
            aria-modal="true"
            data-modal-surface="true"
            aria-labelledby="workoutExerciseTechniqueTitle"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <small>Техника выполнения</small>
                <h2 id="workoutExerciseTechniqueTitle">{exercise.name}</h2>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                data-css-module-control="workout-exercise-modals"
                onClick={onCloseTechnique}
                aria-label="Закрыть пояснение техники"
              >
                ×
              </button>
            </header>
            <div className={styles.techniqueContent}>
              <span aria-hidden="true">i</span>
              <p>{techniqueHint}</p>
            </div>
          </section>
        </div>,
        document.body
      )}
    </>
  );
}
