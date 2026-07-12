export default function WorkoutExerciseVideoFrame({
  exercise,
  exerciseVideoFailed,
  fallbackHint,
  inlinePlayingVideoId,
  inlineVideoControlsVisible,
  onFullscreenVideo,
  onInlineVideoPlayFailed,
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
      className={`workoutExerciseVideoFrame ${!exercise.video || exerciseVideoFailed ? "fallback" : ""}`}
    >
      {hasVideo ? (
        <>
          <video
            key={`${exercise.id}:${videoRetryToken}`}
            className="exerciseVideo"
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
            <span className="workoutExerciseVideoLoading">Загрузка видео...</span>
          )}
          {inlinePlayingVideoId !== exercise.id && (
            <button
              type="button"
              className={`workoutExerciseInlinePlayButton ${inlineVideoControlsVisible ? "" : "is-hidden"}`}
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
              className={`workoutExerciseInlinePauseButton ${inlineVideoControlsVisible ? "" : "is-hidden"}`}
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
            className="workoutExerciseFullscreenButton"
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
        <div className="workoutExerciseVideoFallback">
          <strong>{exercise.video ? "Видео техники недоступно" : "Видео появится позже"}</strong>
          <small>{fallbackHint}</small>
          {exercise.video && exerciseVideoFailed && (
            <button type="button" onClick={onRetryVideo}>
              Повторить загрузку
            </button>
          )}
        </div>
      )}
    </div>
  );
}
