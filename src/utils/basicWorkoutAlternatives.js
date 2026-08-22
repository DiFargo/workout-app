import {
  BASIC_WORKOUT_EXERCISE_GROUPS,
  BASIC_WORKOUT_EXERCISE_LIBRARY
} from "../data/basicWorkoutExerciseLibrary.js";

const GROUP_MATCHERS = [
  ["posterior_chain", /румын|станов|сгибани[ея] ног|ягодич|гиперэкстензи|мост/iu],
  ["quads", /жим ног|присед|разгибани[ея] ног|выпад|болгар|зашагив/iu],
  ["calves", /икр|нос[ок]/iu],
  ["vertical_pull", /тяга.*(верхн|хаммер)|подтяг|пуловер/iu],
  ["horizontal_pull", /тяга.*(гантел|наклон|т.?гриф|горизонт|нижн|рычаж)|греб/iu],
  ["chest_incline", /жим.*наклон|наклон.*жим/iu],
  ["rear_delts", /задн.*дельт|фейс.?пул|тяга.*лицу/iu],
  ["chest_fly", /сведени[ея].*(гантел|рук)|разведени[ея].*(гантел|рук)|пек.?дек|бабочк/iu],
  ["chest_press", /жим.*(л[её]жа|груд)|отжиман/iu],
  ["shoulder_press", /вертикальн.*жим|жим.*(сидя|стоя|над головой)|жим от плеч/iu],
  ["side_delts", /отведени[ея].*(рук|руки)|средн.*дельт|подъ[её]м.*сторон/iu],
  ["biceps", /сгибани[ея].*рук|бицепс|молотк|ez.?гриф/iu],
  ["triceps", /разгибани[ея].*рук|трицепс|французск/iu],
  ["core", /пресс|скручивани[ея]|планк|dead bug|дед баг|подъ[её]м.*(ног|колен)/iu]
];

// Trainer-created exercises can be deliberately named in a way that does not
// match a movement from the compact library.  In that case the saved muscle
// group is still enough to show an honest anatomy reference.  Keep this
// mapping conservative: an unknown group must remain unknown rather than
// receiving an unrelated exercise illustration.
const TRAINER_MUSCLE_GROUP_MATCHERS = [
  ["rear_delts", /задн.*дельт/iu],
  ["side_delts", /средн.*дельт|боков.*дельт/iu],
  ["shoulder_press", /плеч|дельт/iu],
  ["chest_press", /груд/iu],
  ["vertical_pull", /широч|верх.*спин/iu],
  ["horizontal_pull", /спин/iu],
  ["posterior_chain", /ягод|задн.*бед|бицепс.*бед|задн.*ног/iu],
  ["quads", /квадрицепс|передн.*бед|ног/iu],
  ["calves", /икр/iu],
  ["biceps", /бицепс/iu],
  ["triceps", /трицепс/iu],
  ["core", /пресс|кор|живот/iu]
];

const GROUP_BY_ID = new Map(BASIC_WORKOUT_EXERCISE_GROUPS.map((group) => [group.id, group]));

function normalizeExerciseName(name = "") {
  return String(name || "")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/\s+/gu, " ")
    .trim();
}

function exerciseNames(exercise = {}) {
  return [exercise.name, ...(Array.isArray(exercise.aliases) ? exercise.aliases : [])]
    .map(normalizeExerciseName)
    .filter(Boolean);
}

function namesMatch(sourceName, candidateName) {
  return sourceName === candidateName
    || sourceName.includes(candidateName)
    || candidateName.includes(sourceName);
}

export function getBasicWorkoutExerciseGroup(exercise = {}) {
  const safeExercise = exercise && typeof exercise === "object" ? exercise : {};
  const savedGroup = [
    safeExercise.basicExerciseGroupId,
    safeExercise.groupId,
    safeExercise.muscleGroup
  ]
    .map((value) => String(value || "").trim())
    .map((groupId) => GROUP_BY_ID.get(groupId))
    .find(Boolean);
  if (savedGroup) return savedGroup;

  const libraryId = [
    safeExercise.replacementId,
    safeExercise.basicExerciseOverrideId,
    safeExercise.basicExerciseId,
    safeExercise.basicExerciseLibraryId,
    safeExercise.libraryExerciseId,
    safeExercise.id
  ].find((id) => BASIC_WORKOUT_EXERCISE_LIBRARY.some((item) => item.id === id));
  if (libraryId) {
    const libraryExercise = BASIC_WORKOUT_EXERCISE_LIBRARY.find((item) => item.id === libraryId);
    return GROUP_BY_ID.get(libraryExercise?.groupId) || null;
  }

  const trainerGroupTexts = [
    safeExercise.muscleGroup,
    safeExercise.basicExerciseGroupTitle
  ]
    .map(normalizeExerciseName)
    .filter(Boolean);
  const trainerGroupMatch = TRAINER_MUSCLE_GROUP_MATCHERS.find(([, matcher]) => (
    trainerGroupTexts.some((value) => matcher.test(value))
  ));

  const normalizedName = normalizeExerciseName(safeExercise.name);
  if (!normalizedName) return trainerGroupMatch ? GROUP_BY_ID.get(trainerGroupMatch[0]) || null : null;

  const libraryMatch = BASIC_WORKOUT_EXERCISE_LIBRARY.find((item) => (
    exerciseNames(item).some((candidateName) => namesMatch(normalizedName, candidateName))
  ));
  if (libraryMatch) return GROUP_BY_ID.get(libraryMatch.groupId) || null;

  const matchedGroup = GROUP_MATCHERS.find(([, matcher]) => matcher.test(normalizedName));
  if (matchedGroup) return GROUP_BY_ID.get(matchedGroup[0]) || null;

  return trainerGroupMatch ? GROUP_BY_ID.get(trainerGroupMatch[0]) || null : null;
}

function getPreferredLocation(plan = {}) {
  const location = String(plan?.quizProfile?.location || plan?.profile?.location || "").trim().toLowerCase();
  return location === "home" ? "home" : "gym";
}

function toAlternative(item, group) {
  return {
    id: item.id,
    name: item.name,
    sourceId: item.sourceId || "",
    rest: item.rest,
    requiresWeight: item.requiresWeight,
    note: item.note,
    equipment: item.equipment,
    groupId: group.id,
    groupTitle: group.title,
    groupLabel: group.shortTitle
  };
}

export function getBasicWorkoutAlternatives(exercise = {}, workout = {}, plan = {}) {
  const group = getBasicWorkoutExerciseGroup(exercise);
  if (!group) return [];

  const exerciseName = normalizeExerciseName(exercise.name);
  const currentLibraryId = [
    exercise?.replacementId,
    exercise?.basicExerciseOverrideId,
    exercise?.basicExerciseId,
    exercise?.basicExerciseLibraryId,
    exercise?.libraryExerciseId
  ].find((id) => BASIC_WORKOUT_EXERCISE_LIBRARY.some((item) => item.id === id));
  const originalExerciseName = normalizeExerciseName(exercise.replacementOf);
  const unavailableNames = new Set(
    (Array.isArray(workout?.exercises) ? workout.exercises : [])
      .filter((item) => item?.id !== exercise?.id)
      .map((item) => normalizeExerciseName(item?.name))
  );
  const groupExercises = BASIC_WORKOUT_EXERCISE_LIBRARY.filter((item) => item.groupId === group.id);
  const originalExercise = originalExerciseName
    ? groupExercises.find((item) => exerciseNames(item).includes(originalExerciseName))
      || groupExercises.find((item) => (
      exerciseNames(item).some((candidateName) => namesMatch(originalExerciseName, candidateName))
    ))
    : null;
  const availableExercises = groupExercises.filter((item) => (
    item.id !== currentLibraryId
      && !exerciseNames(item).some((candidateName) => namesMatch(exerciseName, candidateName))
      && !unavailableNames.has(normalizeExerciseName(item.name))
  ));
  const location = getPreferredLocation(plan);
  const localAlternatives = availableExercises.filter((item) => item.locations.includes(location));
  const alternatives = localAlternatives.length >= 3 ? localAlternatives : availableExercises;
  const orderedAlternatives = originalExercise && availableExercises.some((item) => item.id === originalExercise.id)
    ? [originalExercise, ...alternatives.filter((item) => item.id !== originalExercise.id)]
    : alternatives;

  return orderedAlternatives
    .slice(0, 3)
    .map((item) => toAlternative(item, group));
}

export function replaceBasicWorkoutExerciseInPlan(plan = {}, workoutId = "", exerciseId = "", alternative = {}) {
  const changedAt = new Date().toISOString();
  let replacement = null;
  const workouts = (Array.isArray(plan?.workouts) ? plan.workouts : []).map((workout) => {
    if (workout?.id !== workoutId) return workout;

    return {
      ...workout,
      exercises: (workout.exercises || []).map((exercise) => {
        if (exercise?.id !== exerciseId) return exercise;

        replacement = {
          ...exercise,
          name: alternative.name || exercise.name,
          video: alternative.video || "",
          rest: alternative.rest || exercise.rest || "75 сек",
          note: alternative.note || "",
          description: alternative.note || "",
          technique: alternative.note || "",
          requiresWeight: alternative.requiresWeight ?? exercise.requiresWeight,
          usesWeight: alternative.requiresWeight ?? exercise.usesWeight,
          basicExerciseGroupId: alternative.groupId || getBasicWorkoutExerciseGroup(exercise)?.id || "",
          basicExerciseGroupTitle: alternative.groupTitle || getBasicWorkoutExerciseGroup(exercise)?.title || "",
          basicExerciseId: alternative.id || "",
          basicExerciseLibraryId: alternative.id || "",
          sourceId: alternative.sourceId || "",
          equipment: alternative.equipment || exercise.equipment || "",
          replacementOf: exercise.replacementOf || exercise.name || "",
          replacementId: alternative.id || "",
          replacementChangedAt: changedAt,
          sets: (exercise.sets || []).map((set) => {
            const targetSet = { ...(set || {}) };
            delete targetSet.completed;
            delete targetSet.enteredReps;
            delete targetSet.enteredWeight;

            return {
              ...targetSet,
              completed: false,
              enteredReps: "",
              enteredWeight: ""
            };
          })
        };

        return replacement;
      })
    };
  });

  return {
    plan: { ...plan, workouts },
    replacement
  };
}
