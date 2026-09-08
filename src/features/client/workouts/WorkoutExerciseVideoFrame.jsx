import { Info, Maximize2 } from "lucide-react";
import { Pause, Play } from "lucide";
import MorphingIcon from "../../../shared/ui/MorphingIcon";
import BasicWorkoutExerciseIllustration from "./BasicWorkoutExerciseIllustration";
import styles from "./WorkoutExerciseVideoFrame.module.css";

export default function WorkoutExerciseVideoFrame({
  exercise,
  exerciseVideoFailed,
  fallbackHint,
  inlinePlayingVideoId,
  inlineVideoControlsVisible,
  onFullscreenVideo,
  onInlineVideoPlayFailed,
  onOpenTechnique,
  showTechniqueButton = true,
  onRetryVideo,
  onVideoCanPlay,
  onVideoEnded,
  onVideoError,
  onVideoLoadedMetadata,
  onVideoLoadStart,
  onVideoPause,
  onVideoPlay,
  videoLoadingId,
  videoRetryToken
}) {
  const hasVideo = Boolean(exercise.video && !exerciseVideoFailed);
  const isInlinePlaying = inlinePlayingVideoId === exercise.id;

  return (
    <div
      data-testid="workout-exercise-video-frame"
      className={styles.frame}
    >
      {hasVideo ? (
        <>
          <video
            key={`${exercise.id}:${videoRetryToken}`}
            className={styles.video}
            data-css-module-control="workout-exercise-video"
            src={exercise.video}
            playsInline
            preload="auto"
            onPointerDown={(event) => event.stopPropagation()}
            onTouchStart={(event) => event.stopPropagation()}
            onTouchMove={(event) => event.stopPropagation()}
            onTouchEnd={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              if (event.currentTarget.paused) {
                event.currentTarget.play().catch(onInlineVideoPlayFailed);
              } else {
                event.currentTarget.pause();
              }
            }}
            onPlay={onVideoPlay}
            onPause={onVideoPause}
            onEnded={onVideoEnded}
            onLoadStart={onVideoLoadStart}
            onCanPlay={onVideoCanPlay}
            onLoadedMetadata={onVideoLoadedMetadata}
            onError={onVideoError}
          />
          {videoLoadingId === exercise.id && (
            <span className={styles.loading}>Загрузка видео...</span>
          )}
          <button
            type="button"
            className={`${styles.inlineControl} ${isInlinePlaying ? styles.pauseButton : styles.playButton} ${inlineVideoControlsVisible ? "" : styles.hidden}`}
            data-css-module-control="workout-exercise-video"
            onClick={(event) => {
              event.stopPropagation();
              const video = event.currentTarget.parentElement?.querySelector("video");
              if (isInlinePlaying) {
                video?.pause();
              } else {
                video?.play().catch(onInlineVideoPlayFailed);
              }
            }}
            aria-label={isInlinePlaying ? "Поставить видео на паузу" : "Воспроизвести видео упражнения"}
          >
            <MorphingIcon icon={isInlinePlaying ? Pause : Play} data-icon-state={isInlinePlaying ? "pause" : "play"} />
          </button>
          <button
            type="button"
            className={styles.fullscreenButton}
            data-css-module-control="workout-exercise-video"
            onClick={(event) => {
              event.stopPropagation();
              event.currentTarget.parentElement?.querySelector("video")?.pause();
              onFullscreenVideo(exercise.video);
            }}
            aria-label="Развернуть видео на весь экран"
            title="На весь экран"
          >
            <Maximize2 aria-hidden="true" />
          </button>
        </>
      ) : (
        <div className={styles.fallbackContent} data-css-module-scope="workout-exercise-video-fallback">
          <BasicWorkoutExerciseIllustration exercise={exercise} className={styles.fallbackIllustration} />
          <div className={styles.fallbackCopy}>
            <strong>{exercise.video ? "Видео техники недоступно" : "Видео появится позже"}</strong>
            <small>{fallbackHint}</small>
            {exercise.video && exerciseVideoFailed && (
              <button
                type="button"
                className={styles.retryButton}
                data-css-module-control="workout-exercise-video"
                onClick={onRetryVideo}
              >
                Повторить загрузку
              </button>
            )}
          </div>
        </div>
      )}
      {showTechniqueButton ? (
        <button
          type="button"
          className={styles.techniqueButton}
          data-css-module-control="workout-exercise-video"
          onClick={(event) => {
            event.stopPropagation();
            onOpenTechnique?.(event);
          }}
          aria-label="Показать технику выполнения"
        >
          <Info aria-hidden="true" />Техника
        </button>
      ) : null}
    </div>
  );
}
