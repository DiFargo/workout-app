export function WorkoutNotFoundPage({ onBackToMenu }) {
  return (
    <div className="app">
      <div className="workoutHeader">
        <button className="backBtn universalFixedBackPointer" onClick={onBackToMenu}>
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
