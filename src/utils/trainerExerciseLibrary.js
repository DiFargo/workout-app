function normalizeExerciseLibraryName(name = "") {
  return String(name || "")
    .trim()
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");
}

function getExerciseVideo(exercise = {}) {
  return exercise?.video || exercise?.videoUrl || exercise?.videoURL || "";
}

function getTemplateWorkouts(template = {}) {
  const templateBlocks = Array.isArray(template.blocks)
    ? template.blocks
    : (template.months || []).flatMap((month) => month.microcycles || month.blocks || []);

  return [
    ...(template.workouts || []),
    ...templateBlocks.flatMap((block) =>
      (block.weeks || []).flatMap((week) => week.workouts || [])
    )
  ];
}

export function buildTrainerExerciseLibraryItems(plan = {}, templates = []) {
  const templateWorkouts = (Array.isArray(templates) ? templates : []).flatMap(getTemplateWorkouts);
  const sources = [
    ...(plan.workouts || []).flatMap((workout) => workout.exercises || []),
    ...templateWorkouts.flatMap((workout) => workout.exercises || [])
  ];
  const library = new Map();

  sources.forEach((exercise) => {
    const key = normalizeExerciseLibraryName(exercise?.name);
    if (!key) return;

    const current = library.get(key);
    const currentVideo = getExerciseVideo(current);
    const nextVideo = getExerciseVideo(exercise);
    if (!current || (!currentVideo && nextVideo)) library.set(key, exercise);
  });

  return [...library.values()];
}
