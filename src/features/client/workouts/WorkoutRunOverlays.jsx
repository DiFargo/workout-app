import { ChevronLeft, RefreshCw, X } from "lucide-react";
import styles from "./WorkoutRunOverlays.module.css";

export function WorkoutNotFoundPage({ onBackToMenu }) {
  return (
    <div className={styles.notFoundPage} data-css-module-scope="workout-not-found-page">
      <div className={styles.notFoundHeader}>
        <button className={styles.backButton} type="button" onClick={onBackToMenu}>
          ← Главное меню
        </button>

        <h1 className={styles.notFoundTitle}>Тренировка не найдена</h1>
      </div>
    </div>
  );
}

export function WorkoutFullscreenVideoOverlay({ videoSrc, onClose, onVideoError }) {
  if (!videoSrc) {
    return null;
  }

  return (
    <div
      className={styles.fullscreenOverlay}
      data-testid="workout-fullscreen-video-overlay"
      data-css-module-scope="workout-fullscreen-video-overlay"
      onClick={onClose}
    >
      <button
        type="button"
        className={styles.fullscreenClose}
        onClick={onClose}
        aria-label="Закрыть видео"
      >
        ✕
      </button>

      <video
        src={videoSrc}
        controls
        autoPlay
        playsInline
        onError={onVideoError}
        onClick={(event) => event.stopPropagation()}
        className={styles.fullscreenVideo}
      />
    </div>
  );
}

export function WorkoutRunTopControls({ isSaving, showBackButton, onExit, onBack }) {
  return (
    <>
      <button
        type="button"
        className={styles.closeButton}
        data-css-module-control="workout-run-overlays"
        onClick={onExit}
        disabled={isSaving}
        aria-label="Выйти из тренировки"
      >
        <X aria-hidden="true" />
      </button>

      <div className={styles.topHeader}>
        <button
          className={styles.backButton}
          type="button"
          onClick={showBackButton ? onBack : onExit}
          disabled={isSaving}
          aria-label="Вернуться к предыдущему экрану"
        >
          <ChevronLeft aria-hidden="true" />
        </button>

        <div aria-hidden="true" />
      </div>
    </>
  );
}

export function WorkoutStageHeading({
  exercise,
  isFinishSlide,
  isStartSlide,
  isWorkoutSaved,
  onOpenSwap,
  showSwapButton = false
}) {
  if (isStartSlide) {
    return null;
  }

  return (
    <>
      <div
        className={`${styles.stageTitle} ${showSwapButton ? styles.stageTitleWithSwap : ""}`}
        data-css-module-scope="workout-stage-heading"
      >
        <span className={styles.stageTitleText}>
          {isFinishSlide
            ? isWorkoutSaved
              ? "Тренировка завершена"
              : "Итоги тренировки"
          : exercise?.name}
        </span>
      </div>
      {showSwapButton && (
        <button
          type="button"
          className={styles.swapExerciseButton}
          data-testid="basic-workout-exercise-swap"
          onClick={(event) => {
            event.stopPropagation();
            onOpenSwap?.();
          }}
          aria-label="Заменить упражнение"
        >
          <RefreshCw aria-hidden="true" />
          <span>Заменить</span>
        </button>
      )}
    </>
  );
}
