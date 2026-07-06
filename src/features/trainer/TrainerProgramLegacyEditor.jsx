import TrainerProgramNameField from "./TrainerProgramNameField";
import TrainerProgramWorkoutDayEditor from "./TrainerProgramWorkoutDayEditor";

export default function TrainerProgramLegacyEditor({
  addMonthBlock,
  addMonthExercise,
  addMonthExerciseSet,
  addMonthWeek,
  addMonthWorkout,
  addProgramMonth,
  adminExerciseLibrary,
  adminExerciseSearch,
  adminExerciseVideoUploadingId,
  adminOpenProgramBlocks,
  adminOpenProgramWeeks,
  adminOpenWorkoutId,
  adminProgramSwipeOpenKey,
  adminSelectedExerciseId,
  cancelMonthExerciseEdit,
  confirmRemoveMonthWorkout,
  handleAdminProgramSwipeCancel,
  handleAdminProgramSwipeClick,
  handleAdminProgramSwipeEnd,
  handleAdminProgramSwipeStart,
  handleMonthProgramBack,
  monthBlocks,
  monthGroups,
  monthProgram,
  openCopyMonthProgramBlock,
  openMonthExerciseEditor,
  removeMonthBlock,
  removeMonthExerciseSet,
  removeMonthWeek,
  removeProgramMonth,
  saveMonthExerciseEdit,
  setAdminExerciseSearch,
  setAdminOpenWorkoutId,
  setAdminSelectedExerciseId,
  toggleMonthProgramBlock,
  toggleMonthProgramWeek,
  updateMonthExercise,
  updateMonthExerciseName,
  updateMonthExerciseSet,
  updateMonthProgramName,
  updateMonthWorkout,
  updateProgramMonth,
  uploadMonthExerciseVideo
}) {
  return (
    <>
      <TrainerProgramNameField
        monthProgram={monthProgram}
        updateMonthProgramName={updateMonthProgramName}
      />

      <div className="monthProgramMonths">
        {monthGroups.map((month, monthIndex) => {
          const monthHasActiveWorkout = (month.microcycles || month.blocks || []).some((block) =>
            (block.weeks || []).some((week) =>
              (week.workouts || []).some((workout) => workout.id === adminOpenWorkoutId)
            )
          );

          return (
            <section
              className={`monthProgramMonth${monthHasActiveWorkout ? " active" : ""}`}
              key={month.id}
            >
              <div className="monthProgramMonthHead">
                <div className="monthProgramMonthTitleEditor">
                  <span>Месяц {monthIndex + 1}</span>
                  <input
                    value={month.name || `Месяц ${monthIndex + 1}`}
                    onChange={(event) => updateProgramMonth(month.id, { name: event.target.value })}
                    aria-label={`Название месяца ${monthIndex + 1}`}
                  />
                </div>
                <button
                  className="monthProgramRemoveMonth"
                  type="button"
                  onClick={() => removeProgramMonth(month.id)}
                  aria-label={`Удалить ${month.name || `месяц ${monthIndex + 1}`}`}
                >
                  ×
                </button>
              </div>

              <div className="monthProgramBlocks monthProgramPremiumBlocks">
                {(month.microcycles || month.blocks || []).map((block) => {
                  const blockIndex = monthBlocks.findIndex((item) => item.id === block.id);
                  const blockWorkouts = (block.weeks || []).flatMap((week) =>
                    (week.workouts || []).map((workout) => ({ workout, week }))
                  );
                  const activeWorkoutContext = blockWorkouts.find(({ workout }) => workout.id === adminOpenWorkoutId);
                  const isBlockOpen = Boolean(adminOpenProgramBlocks[block.id]);
                  return (
                    <div
                      className={`programEditorSwipeRow${activeWorkoutContext ? " active" : ""}${adminProgramSwipeOpenKey === `block:${block.id}` ? " delete-open" : ""}`}
                      key={block.id}
                      onPointerDown={(event) => handleAdminProgramSwipeStart(`block:${block.id}`, event)}
                      onPointerUp={(event) => handleAdminProgramSwipeEnd(`block:${block.id}`, event)}
                      onPointerCancel={(event) => handleAdminProgramSwipeCancel(`block:${block.id}`, event)}
                      onClickCapture={handleAdminProgramSwipeClick}
                    >
                      <button
                        className="programEditorSwipeDelete"
                        type="button"
                        onClick={() => removeMonthBlock(block.id)}
                        aria-label="Удалить микроцикл"
                        title="Удалить микроцикл"
                      >
                        <span aria-hidden="true">🗑</span>
                      </button>
                      <section
                        className={`programEditorSwipeContent monthProgramBlock monthProgramPremiumBlock monthProgramAccordionBlock${isBlockOpen ? " expanded" : ""}${activeWorkoutContext ? " active" : ""}`}
                      >
                        <div className="monthProgramBlockHeaderRow">
                          <button
                            className="monthProgramAccordionHead"
                            type="button"
                            aria-expanded={isBlockOpen}
                            onClick={() => toggleMonthProgramBlock(block.id)}
                          >
                            <div>
                              <strong>{block.name || `Микроцикл ${blockIndex + 1}`}</strong>
                              <span>{(block.weeks || []).length} нед.</span>
                            </div>
                            <small>{blockWorkouts.length} трен.</small>
                          </button>
                          <div className="monthProgramBlockControls">
                            <button
                              className="monthProgramCopyIcon"
                              type="button"
                              onClick={() => openCopyMonthProgramBlock(block.id)}
                              aria-label="Копировать микроцикл"
                              title="Копировать микроцикл"
                            >
                              ⧉
                            </button>
                            {isBlockOpen && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  addMonthWeek(block.id);
                                }}
                              >
                                + Неделя
                              </button>
                            )}
                            <button
                              className="monthProgramHeaderToggle"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleMonthProgramBlock(block.id);
                              }}
                            >
                              {isBlockOpen ? "Свернуть" : "Раскрыть"}
                            </button>
                          </div>
                        </div>

                        {isBlockOpen && (
                          <div className="monthProgramPremiumWeeks">
                            {(block.weeks || []).map((week) => {
                              const isWeekOpen = Boolean(adminOpenProgramWeeks[week.id]);

                              return (
                                <div
                                  className={`programEditorSwipeRow${adminProgramSwipeOpenKey === `week:${week.id}` ? " delete-open" : ""}`}
                                  key={week.id}
                                  onPointerDown={(event) => handleAdminProgramSwipeStart(`week:${week.id}`, event)}
                                  onPointerUp={(event) => handleAdminProgramSwipeEnd(`week:${week.id}`, event)}
                                  onPointerCancel={(event) => handleAdminProgramSwipeCancel(`week:${week.id}`, event)}
                                  onClickCapture={handleAdminProgramSwipeClick}
                                >
                                  <button
                                    className="programEditorSwipeDelete"
                                    type="button"
                                    onClick={() => removeMonthWeek(block.id, week.id)}
                                    aria-label="Удалить неделю"
                                    title="Удалить неделю"
                                  >
                                    <span aria-hidden="true">🗑</span>
                                  </button>
                                  <article className={`programEditorSwipeContent monthProgramPremiumWeek${isWeekOpen ? " expanded" : ""}`}>
                                    <div className="monthProgramPremiumWeekHead">
                                      <button
                                        className="weekEditorToggle"
                                        type="button"
                                        aria-expanded={isWeekOpen}
                                        onClick={() => toggleMonthProgramWeek(week.id)}
                                      >
                                        <span>
                                          <strong>{week.name}</strong>
                                          <small>{(week.workouts || []).length} тренировок</small>
                                        </span>
                                      </button>
                                      <div className="weekEditorHeadActions">
                                        {isWeekOpen && (
                                          <button
                                            className="weekEditorAddDay"
                                            type="button"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              addMonthWorkout(block.id, week.id);
                                            }}
                                          >
                                            + Трен
                                          </button>
                                        )}
                                        <button
                                          className="weekEditorHeaderToggle"
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            toggleMonthProgramWeek(week.id);
                                          }}
                                        >
                                          {isWeekOpen ? "Свернуть" : "Раскрыть"}
                                        </button>
                                      </div>
                                    </div>
                                    {isWeekOpen && (
                                      <div className="monthProgramPremiumDays weekEditorDayList">
                                        {(week.workouts || []).map((workout, workoutIndex) => (
                                          <div
                                            className={`programEditorSwipeRow${adminProgramSwipeOpenKey === `workout:${workout.id}` ? " delete-open" : ""}`}
                                            key={workout.id}
                                            onPointerDown={(event) => handleAdminProgramSwipeStart(`workout:${workout.id}`, event)}
                                            onPointerUp={(event) => handleAdminProgramSwipeEnd(`workout:${workout.id}`, event)}
                                            onPointerCancel={(event) => handleAdminProgramSwipeCancel(`workout:${workout.id}`, event)}
                                            onClickCapture={handleAdminProgramSwipeClick}
                                          >
                                            <button
                                              className="programEditorSwipeDelete"
                                              type="button"
                                              onClick={() => confirmRemoveMonthWorkout(block.id, week.id, workout.id)}
                                              aria-label="Удалить день"
                                              title="Удалить день"
                                            >
                                              <span aria-hidden="true">🗑</span>
                                            </button>
                                            <article className="programEditorSwipeContent weekEditorDayCard">
                                              <button
                                                className="weekEditorDayOpen"
                                                type="button"
                                                onClick={() => {
                                                  setAdminSelectedExerciseId("");
                                                  setAdminExerciseSearch("");
                                                  setAdminOpenWorkoutId(workout.id);
                                                }}
                                              >
                                                <strong>{workout.name || `День ${workoutIndex + 1}`}</strong>
                                                <span>{(workout.exercises || []).length} упражнений</span>
                                              </button>
                                            </article>
                                          </div>
                                        ))}
                                        {(week.workouts || []).length === 0 && <span>Добавьте первый день тренировки</span>}
                                      </div>
                                    )}
                                  </article>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {activeWorkoutContext && (
                          <TrainerProgramWorkoutDayEditor
                            adminExerciseLibrary={adminExerciseLibrary}
                            adminExerciseSearch={adminExerciseSearch}
                            adminExerciseVideoUploadingId={adminExerciseVideoUploadingId}
                            adminSelectedExerciseId={adminSelectedExerciseId}
                            addMonthExercise={addMonthExercise}
                            addMonthExerciseSet={addMonthExerciseSet}
                            block={block}
                            cancelMonthExerciseEdit={cancelMonthExerciseEdit}
                            handleMonthProgramBack={handleMonthProgramBack}
                            openMonthExerciseEditor={openMonthExerciseEditor}
                            removeMonthExerciseSet={removeMonthExerciseSet}
                            saveMonthExerciseEdit={saveMonthExerciseEdit}
                            setAdminExerciseSearch={setAdminExerciseSearch}
                            updateMonthExercise={updateMonthExercise}
                            updateMonthExerciseName={updateMonthExerciseName}
                            updateMonthExerciseSet={updateMonthExerciseSet}
                            updateMonthWorkout={updateMonthWorkout}
                            uploadMonthExerciseVideo={uploadMonthExerciseVideo}
                            week={activeWorkoutContext.week}
                            workout={activeWorkoutContext.workout}
                          />
                        )}
                      </section>
                    </div>
                  );
                })}
              </div>
              <button
                className="monthProgramMonthAddBlock"
                type="button"
                onClick={() => addMonthBlock(month.id)}
              >
                + Микроцикл
              </button>
            </section>
          );
        })}
        <button className="monthProgramAddMonth" type="button" onClick={addProgramMonth}>
          + Добавить месяц
        </button>
      </div>
    </>
  );
}
