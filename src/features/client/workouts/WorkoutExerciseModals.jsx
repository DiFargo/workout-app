import { createPortal } from "react-dom";

export default function WorkoutExerciseModals({
  exercise,
  noteOpen,
  onCloseNote,
  onCloseTechnique,
  onUpdateNote,
  techniqueHint,
  techniqueOpen
}) {
  if (!exercise || exercise.id === "warmup") {
    return null;
  }

  return (
    <>
      {noteOpen && createPortal(
        <div
          className="workoutExerciseModalOverlay"
          role="presentation"
          onClick={onCloseNote}
          onTouchStart={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
          onTouchEnd={(event) => event.stopPropagation()}
        >
          <section
            className="workoutExerciseModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workoutExerciseNoteTitle"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <small>{exercise.name}</small>
                <h2 id="workoutExerciseNoteTitle">Заметка</h2>
              </div>
              <button
                type="button"
                onClick={onCloseNote}
                aria-label="Закрыть заметку"
              >
                ×
              </button>
            </header>
            <textarea
              value={exercise.clientNote || ""}
              onChange={(event) => onUpdateNote(exercise.id, event.target.value)}
              placeholder="Например: уменьшить вес или проверить положение локтей"
              maxLength={240}
            />
            <button
              type="button"
              className="workoutExerciseModalDone"
              onClick={onCloseNote}
            >
              Готово
            </button>
          </section>
        </div>,
        document.body
      )}

      {techniqueOpen && createPortal(
        <div
          className="workoutExerciseModalOverlay"
          role="presentation"
          onClick={onCloseTechnique}
          onTouchStart={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
          onTouchEnd={(event) => event.stopPropagation()}
        >
          <section
            className="workoutExerciseModal workoutTechniqueModal"
            role="dialog"
            aria-modal="true"
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
                onClick={onCloseTechnique}
                aria-label="Закрыть пояснение техники"
              >
                ×
              </button>
            </header>
            <div className="workoutTechniqueModalContent">
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
