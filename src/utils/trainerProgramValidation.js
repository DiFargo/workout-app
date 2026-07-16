const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeNumberText(value) {
  return String(value ?? "").trim().replace(",", ".");
}

function isNonNegativeNumberLike(value, { allowEmpty = true } = {}) {
  const text = normalizeNumberText(value);

  if (!text) return allowEmpty;

  const numericText = text.replace(/\s+/g, "");
  if (/^\d+(\.\d+)?(-\d+(\.\d+)?)?$/.test(numericText)) {
    return numericText.split("-").every((part) => Number(part) >= 0);
  }

  return false;
}

function getProgramName(programName, template) {
  return String(programName || template?.name || template?.title || "").trim();
}

function getTemplateSourceWorkouts(template = {}) {
  const structuredMicrocycles = Array.isArray(template.blocks) && template.blocks.length
    ? template.blocks
    : (template.months || []).flatMap((month) => month.microcycles || month.blocks || []);
  const structuredWorkouts = structuredMicrocycles.flatMap((microcycle) =>
    (microcycle.weeks || []).flatMap((week) => week.workouts || [])
  );

  return structuredWorkouts.length ? structuredWorkouts : (Array.isArray(template.workouts) ? template.workouts : []);
}

function makeResult(errors, cleanDates = []) {
  return {
    ok: errors.length === 0,
    errors,
    cleanDates,
    message: errors[0]?.message || ""
  };
}

export function validateTrainerWorkoutsForAssignment({ programName = "", template = {}, workouts = [] } = {}) {
  const errors = [];
  const resolvedName = getProgramName(programName, template);
  const templateWorkouts = getTemplateSourceWorkouts(template);
  const sourceWorkouts = templateWorkouts.length ? templateWorkouts : (Array.isArray(workouts) ? workouts : []);

  if (!resolvedName) {
    errors.push({
      code: "program_name_required",
      message: "У программы должно быть название перед назначением."
    });
  }

  if (!sourceWorkouts.length) {
    errors.push({
      code: "program_workouts_required",
      message: "В программе должна быть хотя бы одна тренировка."
    });
  }

  sourceWorkouts.forEach((workout, workoutIndex) => {
    const workoutNumber = workoutIndex + 1;
    const workoutName = String(workout?.name || "").trim();
    const exercises = Array.isArray(workout?.exercises) ? workout.exercises : [];

    if (!workoutName) {
      errors.push({
        code: "workout_name_required",
        message: `У тренировки №${workoutNumber} должно быть название.`
      });
    }

    if (!exercises.length) {
      errors.push({
        code: "workout_exercises_required",
        message: `В тренировке "${workoutName || workoutNumber}" должно быть хотя бы одно упражнение.`
      });
    }

    exercises.forEach((exercise, exerciseIndex) => {
      const exerciseNumber = exerciseIndex + 1;
      const exerciseName = String(exercise?.name || "").trim();
      const sets = Array.isArray(exercise?.sets) ? exercise.sets : [];

      if (!exerciseName) {
        errors.push({
          code: "exercise_name_required",
          message: `В тренировке "${workoutName || workoutNumber}" у упражнения №${exerciseNumber} должно быть название.`
        });
      }

      sets.forEach((set, setIndex) => {
        const setNumber = setIndex + 1;
        const repsValue = set?.reps ?? set?.targetReps ?? set?.enteredReps ?? "";
        const weightValue = set?.weight ?? set?.targetWeight ?? set?.enteredWeight ?? "";

        if (!isNonNegativeNumberLike(repsValue, { allowEmpty: false })) {
          errors.push({
            code: "set_reps_invalid",
            message: `В упражнении "${exerciseName || exerciseNumber}" подход №${setNumber}: повторы должны быть неотрицательным числом.`
          });
        }

        if (!isNonNegativeNumberLike(weightValue, { allowEmpty: true })) {
          errors.push({
            code: "set_weight_invalid",
            message: `В упражнении "${exerciseName || exerciseNumber}" подход №${setNumber}: вес не может быть отрицательным или текстовым.`
          });
        }
      });
    });
  });

  return makeResult(errors);
}

export function validateTrainerWorkoutScheduleDates(dates = [], workoutCount = 0) {
  const rawDates = (Array.isArray(dates) ? dates : [])
    .map((date) => String(date || "").trim())
    .filter(Boolean);
  const uniqueDates = [...new Set(rawDates)];
  const duplicateDates = rawDates.filter((date, index) => rawDates.indexOf(date) !== index);
  const cleanDates = uniqueDates.filter((date) => DATE_RE.test(date)).sort();
  const errors = [];

  if (!Number.isFinite(Number(workoutCount)) || Number(workoutCount) <= 0) {
    errors.push({
      code: "schedule_program_required",
      message: "Сначала назначь клиенту программу тренировок."
    });
  }

  if (rawDates.some((date) => !DATE_RE.test(date))) {
    errors.push({
      code: "schedule_date_invalid",
      message: "В расписании есть некорректная дата."
    });
  }

  if (duplicateDates.length) {
    errors.push({
      code: "schedule_date_duplicate",
      message: "Каждая тренировка должна быть назначена на отдельную дату."
    });
  }

  if (cleanDates.length !== Number(workoutCount)) {
    errors.push({
      code: "schedule_date_count_mismatch",
      message: `Нужно выбрать ${workoutCount} дат для ${workoutCount} тренировок.`
    });
  }

  return makeResult(errors, cleanDates);
}
