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
  const sources = [
    ...(plan.workouts || []).flatMap((workout) => (workout.exercises || []).map((exercise) => ({
      exercise,
      librarySource: { type: "plan", workoutId: workout.id || "" }
    }))),
    ...(Array.isArray(templates) ? templates : []).flatMap((template) => getTemplateWorkouts(template).flatMap((workout) =>
      (workout.exercises || []).map((exercise) => ({
        exercise,
        librarySource: { type: "template", templateId: template.id || "" }
      }))
    ))
  ];
  const library = new Map();

  sources.forEach(({ exercise, librarySource }) => {
    const key = normalizeExerciseLibraryName(exercise?.name);
    if (!key) return;

    const current = library.get(key);
    const currentVideo = getExerciseVideo(current);
    const nextVideo = getExerciseVideo(exercise);
    if (!current || (!currentVideo && nextVideo)) library.set(key, { ...exercise, librarySource });
  });

  return [...library.values()];
}

export function patchExerciseInTrainerTemplate(value, exerciseId, patch) {
  if (Array.isArray(value)) {
    return value.map((item) => patchExerciseInTrainerTemplate(item, exerciseId, patch));
  }
  if (!value || typeof value !== "object") return value;

  const isExercise = value.id === exerciseId && (
    Array.isArray(value.sets)
    || "requiresWeight" in value
    || "usesWeight" in value
  );
  const current = isExercise ? { ...value, ...patch } : value;

  return Object.fromEntries(
    Object.entries(current).map(([key, item]) => [key, patchExerciseInTrainerTemplate(item, exerciseId, patch)])
  );
}
