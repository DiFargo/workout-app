import { createPortal } from "react-dom";
import { useEffect, useRef } from "react";
import { hasCompletedExerciseSets } from "../../../utils/auditSafety.js";
import WorkoutExerciseProgressChart from "./WorkoutExerciseProgressChart.jsx";
import styles from "./WorkoutExerciseModals.module.css";

export default function WorkoutExerciseModals({
  alternativeSource = "basic",
  alternatives = [],
  exercise,
  lastExerciseText = "",
  noteOpen,
  onCloseNote,
  onCloseProgress = () => {},
  onCloseSwap,
  onCloseTechnique,
  onSelectAlternative,
  onUpdateNote,
  onRetryProgress,
  onLoadMoreProgress,
  progressOpen = false,
  progressState = null,
  swapOpen,
  techniqueHint,
  techniqueOpen
}) {
  const noteOverlayRef = useRef(null);
  const noteVisible = Boolean(noteOpen && exercise && exercise.id !== "warmup");

  useEffect(() => {
    if (!noteVisible) return undefined;
    const overlay = noteOverlayRef.current;
    const viewport = window.visualViewport;
    let frame = 0;
    const syncViewport = () => {
      overlay.style.setProperty("--workout-note-visible-height", `${viewport?.height ?? window.innerHeight}px`);
      overlay.style.setProperty("--workout-note-visible-width", `${viewport?.width ?? window.innerWidth}px`);
      overlay.style.setProperty("--workout-note-visible-top", `${viewport?.offsetTop ?? 0}px`);
      overlay.style.setProperty("--workout-note-visible-left", `${viewport?.offsetLeft ?? 0}px`);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(syncViewport);
    };
    syncViewport();
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [noteVisible]);

  if (!exercise || exercise.id === "warmup") {
    return null;
  }

  const alternativesGroupLabel = alternatives[0]?.groupLabel || "";
  const swapLocked = hasCompletedExerciseSets(exercise);

  return (
    <>
      {noteOpen && createPortal(
        <div
          ref={noteOverlayRef}
          className={`${styles.overlay} ${styles.noteOverlay}`} data-modal-backdrop="true"
          data-testid="workout-exercise-note-modal"
          data-css-module-scope="workout-exercise-modals"
          role="presentation"
          onClick={onCloseNote}
          onTouchStart={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
          onTouchEnd={(event) => event.stopPropagation()}
        >
          <section
            className={`${styles.modal} ${styles.noteModal}`}
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
              aria-labelledby="workoutExerciseNoteTitle"
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

      {progressOpen && createPortal(
        <div
          className={styles.overlay} data-modal-backdrop="true"
          data-testid="workout-exercise-progress-modal"
          data-css-module-scope="workout-exercise-modals"
          role="presentation"
          onClick={onCloseProgress}
          onTouchStart={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
          onTouchEnd={(event) => event.stopPropagation()}
        >
          <section
            className={`${styles.modal} ${styles.progressModal}`}
            role="dialog"
            aria-modal="true"
            data-modal-surface="true"
            aria-labelledby="workoutExerciseProgressTitle"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <small>Все программы</small>
                <h2 id="workoutExerciseProgressTitle">История и прогресс</h2>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                data-css-module-control="workout-exercise-modals"
                onClick={onCloseProgress}
                aria-label="Закрыть прогресс упражнения"
              >
                ×
              </button>
            </header>
            <div className={styles.progressContent}>
              <strong>{exercise.name}</strong>
              {!progressState && lastExerciseText && !lastExerciseText.includes("нет данных") ? (
                <p>
                  <span>Последнее выполнение</span>
                  {lastExerciseText}
                </p>
              ) : null}
              {progressState?.status === "loading" ? <p role="status">Загружаем последние записи…</p> : null}
              {progressState?.status === "error" ? <div className={styles.historyError} role="alert">
                <p>{progressState.needsHistoryRefresh
                  ? "История изменилась. Обнови список, чтобы продолжить просмотр."
                  : "Не удалось загрузить историю. Проверь подключение и повтори попытку."}</p>
                <button type="button" onClick={onRetryProgress}>{progressState.needsHistoryRefresh ? "Обновить историю" : "Повторить"}</button>
              </div> : null}
              {progressState?.status === "ready" ? <>
                <WorkoutExerciseProgressChart entries={progressState.entries || []} complete={!progressState.hasMore} />
                {progressState.entries?.length ? <ol className={styles.historyEntries}>
                  {progressState.entries.map(entry => <li key={entry.id}>
                    <time dateTime={entry.date}>{new Date(entry.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</time>
                    <strong>{entry.summary}</strong>
                  </li>)}
                </ol> : <p>{progressState.hasMore
                  ? "В загруженных тренировках записей пока нет. Можно посмотреть более ранние."
                  : "В сохранённой истории не найдено сопоставимых выполнений упражнения."}</p>}
                {progressState.loadMoreError ? <p role="alert">{progressState.needsHistoryRefresh
                  ? "История изменилась. Обнови список, чтобы продолжить просмотр."
                  : "Не удалось загрузить более ранние записи. Уже показанные результаты сохранены."}</p> : null}
                {progressState.hasMore ? <>
                  <button type="button" className={styles.historyMore} onClick={progressState.needsHistoryRefresh ? onRetryProgress : onLoadMoreProgress}
                    disabled={progressState.loadingMore} aria-label={progressState.needsHistoryRefresh ? "Обновить историю упражнения" : "Загрузить более ранние записи упражнения"}>
                    {progressState.loadingMore ? "Загружаем…" : progressState.needsHistoryRefresh ? "Обновить историю" : progressState.loadMoreError ? "Повторить загрузку" : "Более ранние записи"}
                  </button>
                  <p>История всех программ загружается частями. Просмотрено тренировок: {progressState.searchedWorkouts}.</p>
                </> : <p>Доступные записи за весь период загружены.</p>}
              </> : null}
            </div>
          </section>
        </div>,
        document.body
      )}

      {swapOpen && createPortal(
        <div
          className={styles.overlay} data-modal-backdrop="true"
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
            <p className={styles.swapHint} role={swapLocked ? "status" : undefined}>
              {swapLocked
                ? "У этого упражнения уже есть выполненные подходы. Заменить его можно только до первого выполненного подхода, чтобы результаты оставались у исходного упражнения. Можно продолжить тренировку или перейти к следующему упражнению."
                : alternativeSource === "trainer"
                ? "Тренер назначил эти варианты для замены. Подходы и повторы сохранятся."
                : <>{alternativesGroupLabel ? `Похожие упражнения: ${alternativesGroupLabel}. ` : ""}Подходы и повторы сохранятся.</>}
            </p>
            {swapLocked ? (
              <button type="button" className={styles.doneButton} onClick={onCloseSwap}>
                Вернуться к упражнению
              </button>
            ) : <div className={styles.alternativeList}>
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
            </div>}
          </section>
        </div>,
        document.body
      )}

      {techniqueOpen && createPortal(
        <div
          className={styles.overlay} data-modal-backdrop="true"
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
