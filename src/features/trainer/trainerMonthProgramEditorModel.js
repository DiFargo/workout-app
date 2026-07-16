export function buildTrainerMonthProgramEditorModel({
  adminOpenWorkoutId,
  adminTrainingTemplates,
  monthBlocks
}) {
  const monthWorkouts = monthBlocks.flatMap((block) =>
    (block.weeks || []).flatMap((week) =>
      (week.workouts || []).map((workout) => ({ ...workout, blockName: block.name, weekName: week.name }))
    )
  );
  const adminExerciseLibrarySources = [
    ...monthWorkouts.flatMap((workout) => workout.exercises || []),
    ...adminTrainingTemplates.flatMap((template) => {
      const templateMicrocycles = Array.isArray(template.blocks)
        ? template.blocks
        : (template.months || []).flatMap((month) => month.microcycles || month.blocks || []);
      return [
        ...(template.workouts || []),
        ...templateMicrocycles.flatMap((microcycle) =>
          (microcycle.weeks || []).flatMap((week) => week.workouts || [])
        )
      ].flatMap((workout) => workout.exercises || []);
    })
  ].filter((exercise) => String(exercise?.name || "").trim());
  const adminExerciseLibrary = Array.from(adminExerciseLibrarySources.reduce((library, exercise) => {
    const key = String(exercise.name).trim().toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/\s+/g, " ");
    const current = library.get(key);
    const currentVideo = String(current?.video || current?.videoUrl || current?.videoURL || "").trim();
    const exerciseVideo = String(exercise?.video || exercise?.videoUrl || exercise?.videoURL || "").trim();
    if (!current || (!currentVideo && exerciseVideo)) library.set(key, exercise);
    return library;
  }, new Map()).values());
  const openMonthWorkoutContext = monthBlocks.flatMap((block) =>
    (block.weeks || []).flatMap((week) =>
      (week.workouts || []).map((workout) => ({ block, week, workout }))
    )
  ).find(({ workout }) => workout.id === adminOpenWorkoutId);

  return {
    adminExerciseLibrary,
    monthWorkouts,
    openMonthWorkoutContext
  };
}
