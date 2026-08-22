function getRussianCountLabel(value, forms) {
  const count = Math.abs(Number(value) || 0) % 100;
  const lastDigit = count % 10;

  if (count > 10 && count < 20) return forms[2];
  if (lastDigit === 1) return forms[0];
  if (lastDigit >= 2 && lastDigit <= 4) return forms[1];
  return forms[2];
}

function getWorkoutOrder(workout = {}, index = 0) {
  const order = Number(workout.order || workout.sortOrder);
  return Number.isFinite(order) && order > 0 ? order : index + 1;
}

export function getBasicWorkoutMicrocycles(plan = {}) {
  const workouts = Array.isArray(plan?.workouts) ? plan.workouts : [];
  const showAllWorkouts = plan?.structure === "variants_then_progression";
  const configuredDays = Number(plan?.profile?.days || plan?.quizProfile?.days);
  const inferredDays = Math.max(1, Math.round(workouts.length / 4) || 1);
  const daysPerWeek = Number.isFinite(configuredDays) && configuredDays > 0
    ? configuredDays
    : inferredDays;
  const declaredCycles = new Map(
    (Array.isArray(plan?.microcycles) ? plan.microcycles : [])
      .map((cycle) => [Number(cycle?.number), cycle])
      .filter(([number]) => Number.isFinite(number) && number > 0)
  );
  const grouped = new Map();

  [...workouts]
    .map((workout, index) => ({ workout, index, order: getWorkoutOrder(workout, index) }))
    .sort((first, second) => first.order - second.order)
    .forEach(({ workout }, index) => {
      const weekNumber = Math.max(1, Number(workout?.weekNumber) || Math.floor(index / daysPerWeek) + 1);
      const microcycleNumber = Math.max(1, Number(workout?.microcycleNumber) || Math.floor((weekNumber - 1) / 2) + 1);
      const current = grouped.get(microcycleNumber) || [];

      current.push({ workout, index, weekNumber });
      grouped.set(microcycleNumber, current);
    });

  return [...grouped.entries()]
    .sort(([first], [second]) => first - second)
    .map(([number, items]) => {
      const weeks = [...new Set(items.map((item) => item.weekNumber))].sort((first, second) => first - second);
      const representativeWeek = weeks[0];
      const declared = declaredCycles.get(number);
      const label = declared?.label || items[0]?.workout?.microcycleLabel || (
        weeks.length > 1
          ? `Микроцикл ${number} · Недели ${weeks[0]}–${weeks[weeks.length - 1]}`
          : `Микроцикл ${number} · Неделя ${weeks[0]}`
      );

      return {
        number,
        label,
        weeks,
        items: showAllWorkouts
          ? items
          : items.filter((item) => item.weekNumber === representativeWeek)
      };
    });
}

export function getBasicWorkoutSummary(workout = {}) {
  const exercises = Array.isArray(workout?.exercises) ? workout.exercises : [];
  const setCount = exercises.reduce((maximum, exercise) => (
    Math.max(maximum, Array.isArray(exercise?.sets) ? exercise.sets.length : 0)
  ), 0);
  const repetitions = [...new Set(exercises.flatMap((exercise) => (
    Array.isArray(exercise?.sets) ? exercise.sets : []
  )).map((set) => Number(set?.reps)).filter((value) => Number.isFinite(value) && value > 0))];
  const repetitionLabel = repetitions.length === 1
    ? `${repetitions[0]} ${getRussianCountLabel(repetitions[0], ["повторение", "повторения", "повторений"])} `
    : repetitions.length > 1
      ? `${Math.min(...repetitions)}–${Math.max(...repetitions)} повторений`
      : "";

  return [
    exercises.length ? `${exercises.length} ${getRussianCountLabel(exercises.length, ["упражнение", "упражнения", "упражнений"])}` : "",
    setCount ? `${setCount} ${getRussianCountLabel(setCount, ["подход", "подхода", "подходов"])}` : "",
    repetitionLabel.trim()
  ].filter(Boolean).join(" · ");
}
