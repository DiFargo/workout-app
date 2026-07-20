import { Info } from "lucide-react";
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
          {inlinePlayingVideoId !== exercise.id && (
            <button
              type="button"
              className={`${styles.inlineControl} ${styles.playButton} ${inlineVideoControlsVisible ? "" : styles.hidden}`}
              data-css-module-control="workout-exercise-video"
              onClick={(event) => {
                event.stopPropagation();
                const video = event.currentTarget.parentElement?.querySelector("video");
                video?.play().catch(onInlineVideoPlayFailed);
              }}
              aria-label="Воспроизвести видео упражнения"
            >
              <span aria-hidden="true">▶</span>
            </button>
          )}
          {inlinePlayingVideoId === exercise.id && (
            <button
              type="button"
              className={`${styles.inlineControl} ${styles.pauseButton} ${inlineVideoControlsVisible ? "" : styles.hidden}`}
              data-css-module-control="workout-exercise-video"
              onClick={(event) => {
                event.stopPropagation();
                event.currentTarget.parentElement?.querySelector("video")?.pause();
              }}
              aria-label="Поставить видео на паузу"
            >
              <span aria-hidden="true">Ⅱ</span>
            </button>
          )}
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
            <span aria-hidden="true">⛶</span>
          </button>
        </>
      ) : (
        <div className={styles.fallbackContent} data-css-module-scope="workout-exercise-video-fallback">
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
      )}
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
    </div>
  );
}
