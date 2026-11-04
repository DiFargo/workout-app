const runFields = [
  "completedAt", "completedDate", "startedAt", "finishedAt", "statusUpdatedAt",
  "plannedSnapshot", "completionApplied", "readiness", "postWorkoutFeedback",
  "clientComment", "clientNote", "completedSetIds", "completedSets",
  "actualReps", "actualWeight", "completed", "completedRounds"
];

function removeEditorState(value) {
  if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) {
    if (key.startsWith("_editor")) delete value[key];
    else removeEditorState(item);
  }
  return value;
}

function clearRunState(value) {
  for (const key of runFields) delete value[key];
  delete value.isCompleted;
  delete value.isCompletedOffDate;
  delete value.isMissed;
  return value;
}

// Copy the prescription and library links, never the result of its last run.
export function copyTrainerWorkoutDay(source, { suffix, order }) {
  const copy = clearRunState(removeEditorState(structuredClone(source)));
  for (const key of [
    "displayStatus", "displayCompletedDate", "displayPlannedDate", "displayOffDate",
    "date", "scheduledDate", "plannedDate", "movedToDate", "rescheduledFromDate",
    "scheduleShiftedAt", "isShifted", "durationSeconds", "createdAt", "updatedAt", "assignedAt"
  ]) delete copy[key];
  const exerciseIds = new Map((copy.exercises || []).map((exercise, index) => [exercise.id, `exercise_${suffix}_${index}`]));
  const blocks = [...(copy.taskBlocks || []), ...(copy.exercises || []).map(exercise => exercise.taskBlockConfig).filter(Boolean)];
  const blockIds = new Map(blocks.map((block, index) => [block.id, `task_block_${suffix}_${index}`]));
  const copyBlock = block => ({ ...clearRunState(block), id: blockIds.get(block.id) || block.id,
    exerciseIds: (block.exerciseIds || []).map(id => exerciseIds.get(id)).filter(Boolean) });
  return {
    ...copy,
    id: `workout_${suffix}`,
    name: `${source.name || "Тренировка"} — копия`,
    status: "planned",
    completed: false,
    order, sortOrder: order, scheduleOrder: order,
    ...(Array.isArray(copy.taskBlocks) ? { taskBlocks: copy.taskBlocks.map(copyBlock) } : {}),
    exercises: (copy.exercises || []).map((exercise, exerciseIndex) => ({
      ...clearRunState(exercise),
      id: exerciseIds.get(exercise.id),
      completed: false,
      ...(exercise.taskBlockId ? { taskBlockId: blockIds.get(exercise.taskBlockId) || exercise.taskBlockId } : {}),
      ...(exercise.taskBlockConfig ? { taskBlockConfig: copyBlock(exercise.taskBlockConfig) } : {}),
      sets: (exercise.sets || []).map((set, setIndex) => {
        const next = clearRunState(set);
        for (const key of ["targetReps", "targetWeight", "targetDurationSeconds", "aiOriginalWeight", "aiSuggestedWeight", "aiReadinessId", "aiReadinessTitle", "progressionSourceWorkoutId", "progressionUpdatedAt"]) delete next[key];
        return { ...next, id: `set_${suffix}_${exerciseIndex}_${setIndex}`,
          completed: false, completedRounds: 0, enteredReps: "", enteredWeight: "" };
      })
    }))
  };
}
