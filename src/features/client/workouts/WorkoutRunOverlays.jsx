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
        ×
      </button>

      <div className={styles.topHeader}>
        {showBackButton && (
          <button
            className={styles.backButton}
            type="button"
            onClick={onBack}
            aria-label="Вернуться к предыдущему экрану"
          >
            ←
          </button>
        )}

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
  onOpenTechnique
}) {
  if (isStartSlide) {
    return null;
  }

  const showTechniqueButton = !isFinishSlide && exercise?.id !== "warmup";

  return (
      <div
        className={`${styles.stageTitle} ${showTechniqueButton ? styles.withTechniqueButton : ""}`}
        data-css-module-scope="workout-stage-heading"
      >
        <span className={styles.stageTitleText}>
          {isFinishSlide
            ? isWorkoutSaved
              ? "Тренировка завершена"
              : "Итоги тренировки"
            : exercise?.name}
        </span>
        {showTechniqueButton && (
          <button
            type="button"
            className={styles.techniqueButton}
            data-css-module-control="workout-run-overlays"
            onClick={onOpenTechnique}
            aria-label="Показать пояснение техники"
            title="Техника выполнения"
          >
            i
          </button>
        )}
      </div>
  );
}
