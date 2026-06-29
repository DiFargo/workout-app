export function WorkoutNotFoundPage({ onBackToMenu }) {
  return (
    <div className="app">
      <div className="workoutHeader">
        <button className="backBtn universalFixedBackPointer" type="button" onClick={onBackToMenu}>
          ← Главное меню
        </button>

        <h1 className="workoutTitle">Тренировка не найдена</h1>
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
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100dvh",
        background: "rgba(0,0,0,0.95)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999
      }}
    >
      <button
        type="button"
        onClick={onClose}
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          fontSize: "28px",
          background: "none",
          color: "white",
          border: "none",
          cursor: "pointer"
        }}
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
        style={{
          width: "100%",
          maxWidth: "900px",
          borderRadius: "12px"
        }}
      />
    </div>
  );
}

export function WorkoutRunTopControls({ isSaving, showBackButton, onExit, onBack }) {
  return (
    <>
      <button
        type="button"
        className="workoutCloseButton"
        onClick={onExit}
        disabled={isSaving}
        aria-label="Выйти из тренировки"
      >
        ×
      </button>

      <div className="workoutHeader workoutHeaderCompact">
        {showBackButton && (
          <button
            className="backIconBtn universalFixedBackPointer"
            type="button"
            onClick={onBack}
            aria-label="Вернуться назад"
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
  currentExerciseIndex,
  exercise,
  exerciseCount,
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
    <>
      {!isFinishSlide && (
        <div className="exerciseCounter">
          {currentExerciseIndex === 0
            ? "Разминка"
            : `Упражнение ${currentExerciseIndex} из ${exerciseCount}`}
        </div>
      )}

      <div className={`workoutStageTitle ${showTechniqueButton ? "withTechniqueButton" : ""}`}>
        <span>
          {isFinishSlide
            ? isWorkoutSaved
              ? "Тренировка завершена"
              : "Итоги тренировки"
            : exercise?.name}
        </span>
        {showTechniqueButton && (
          <button
            type="button"
            className="workoutTechniqueButton"
            onClick={onOpenTechnique}
            aria-label="Показать пояснение техники"
            title="Техника выполнения"
          >
            i
          </button>
        )}
      </div>
    </>
  );
}
