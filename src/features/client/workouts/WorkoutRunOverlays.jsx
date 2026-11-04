import ProtectedExerciseVideo from "../../../components/media/ProtectedExerciseVideo.jsx";
import { ChevronDown, ChevronLeft, RefreshCw, X } from "lucide-react";
import WorkoutVideoProtectionMark from "./WorkoutVideoProtectionMark";
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

      <div className={styles.fullscreenVideoFrame}>
        <ProtectedExerciseVideo
          src={videoSrc}
          controls
          autoPlay
          playsInline
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture
          disableRemotePlayback
          draggable={false}
          onContextMenu={(event) => event.preventDefault()}
          onError={onVideoError}
          onClick={(event) => event.stopPropagation()}
          className={styles.fullscreenVideo}
        />
        <WorkoutVideoProtectionMark className={styles.fullscreenVideoWatermark} />
      </div>
    </div>
  );
}

export function WorkoutRunTopControls({ isSaving, showBackButton, onExit, onBack }) {
  return (
    <>
      {!showBackButton && <button
        type="button"
        className={styles.closeButton}
        data-css-module-control="workout-run-overlays"
        onClick={onExit}
        disabled={isSaving}
        aria-label="Выйти из тренировки"
      >
        <X aria-hidden="true" />
      </button>}

      <div className={styles.topHeader}>
        {showBackButton && <button
          className={styles.backButton}
          type="button"
          data-css-module-control="workout-run-overlays"
          onClick={onBack}
          disabled={isSaving}
          aria-label="Вернуться к предыдущему экрану"
        >
          <ChevronLeft aria-hidden="true" />
          <span>Назад</span>
        </button>}

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
  showSwapButton = false,
  inFlow = false,
  progressLabel = "",
  onPrevious,
  onOpenExercisePicker,
  exercisePickerOpen = false
}) {
  const exerciseTitle = [exercise?.name, exercise?.title, exercise?.exerciseName]
    .map((value) => String(value || "").trim())
    .find(Boolean) || "Упражнение";

  if (isStartSlide) {
    return null;
  }

  return (
    <>
      <div
        className={`${styles.stageTitle} ${showSwapButton ? styles.stageTitleWithSwap : ""} ${inFlow ? styles.stageTitleInFlow : ""}`}
        data-css-module-scope="workout-stage-heading"
      >
        {onPrevious && <button type="button" className={styles.previousExercise} onClick={onPrevious} aria-label="Предыдущее упражнение"><ChevronLeft aria-hidden="true" /></button>}
        <div className={styles.stageTitleContent}>
          {onOpenExercisePicker && inFlow && !isFinishSlide ? <button
            type="button" className={styles.exercisePickerTrigger}
            onClick={onOpenExercisePicker} aria-label={`Выбрать упражнение. ${exerciseTitle}. ${progressLabel}`}
            aria-haspopup="dialog" aria-expanded={exercisePickerOpen} data-testid="workout-exercise-picker-trigger"
          >
            <span className={`${styles.stageTitleText} ${styles.exerciseTitle}`}>{exerciseTitle}</span>
            <span className={styles.stageTitleProgress} data-testid="workout-exercise-progress">
              <span>{progressLabel}</span><ChevronDown aria-hidden="true" />
            </span>
          </button> : <>
          <span className={`${styles.stageTitleText} ${!isFinishSlide ? styles.exerciseTitle : ""}`}>
            {isFinishSlide
              ? isWorkoutSaved
                ? "Тренировка завершена"
                : "Итоги тренировки"
              : exerciseTitle}
          </span>
          {inFlow && !isFinishSlide && progressLabel ? (
            <span className={styles.stageTitleProgress} data-testid="workout-exercise-progress">
              <span>{progressLabel}</span>
              <ChevronDown aria-hidden="true" />
            </span>
          ) : null}
          </>}
        </div>
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
