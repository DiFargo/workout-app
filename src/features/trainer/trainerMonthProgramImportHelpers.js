import {
  applyExerciseLibraryDefaults,
  distributeMicrocycleWorkouts,
  getMicrocycleWeekNumbers
} from "../../utils/auditSafety";

export function createTrainerMonthProgramImportHelpers({
  adminExerciseLibrary,
  normalizeMonthProgram
}) {
  function normalizeImportedMonthlyProgram(rawProgram = {}) {
    if (rawProgram.schema && !["tren-monthly-program-v1", "tren-monthly-program-v2"].includes(rawProgram.schema)) {
      throw new Error("Неверный формат файла программы.");
    }

    const importedMonths = Array.isArray(rawProgram.months) ? rawProgram.months : [];
    const nestedMicrocycles = importedMonths.flatMap((month, monthIndex) =>
      (Array.isArray(month.microcycles) ? month.microcycles : (month.blocks || [])).map((microcycle) => ({
        ...microcycle,
        monthId: microcycle.monthId || month.id || `month_${monthIndex + 1}`
      }))
    );
    let importedMicrocycles = nestedMicrocycles.length
      ? nestedMicrocycles
      : (Array.isArray(rawProgram.blocks) ? rawProgram.blocks : []);

    if (!importedMicrocycles.length && Array.isArray(rawProgram.weeks)) {
      importedMicrocycles = Array.from(
        { length: Math.ceil(rawProgram.weeks.length / 2) },
        (_, microcycleIndex) => ({
          id: `microcycle_${microcycleIndex + 1}`,
          name: `Микроцикл ${microcycleIndex + 1}`,
          weeks: rawProgram.weeks.slice(microcycleIndex * 2, microcycleIndex * 2 + 2)
        })
      );
    }

    if (!importedMicrocycles.length) {
      throw new Error("В файле не найдены микроциклы или недели.");
    }

    const importStamp = Date.now();
    const normalizedBlocks = importedMicrocycles.map((microcycle, microcycleIndex) => {
      const weeks = Array.isArray(microcycle.weeks) ? microcycle.weeks : [];
      return {
        id: microcycle.id || `microcycle_${importStamp}_${microcycleIndex}`,
        name: String(microcycle.name || `Микроцикл ${microcycleIndex + 1}`)
          .replace(/^Блок(?=\s*\d)/i, "Микроцикл"),
        monthId: microcycle.monthId || `month_${Math.floor(microcycleIndex / 2) + 1}`,
        weeks: weeks.map((week, weekIndex) => ({
          id: week.id || `week_${importStamp}_${microcycleIndex}_${weekIndex}`,
          name: week.name || `Неделя ${microcycleIndex * 2 + weekIndex + 1}`,
          workouts: (Array.isArray(week.workouts) ? week.workouts : []).map((workout, workoutIndex) => ({
            id: workout.id || `workout_${importStamp}_${microcycleIndex}_${weekIndex}_${workoutIndex}`,
            name: workout.name || `${week.name || `Неделя ${microcycleIndex * 2 + weekIndex + 1}`} — Тренировка ${workoutIndex + 1}`,
            exercises: (Array.isArray(workout.exercises) ? workout.exercises : []).map((exercise, exerciseIndex) =>
              applyExerciseLibraryDefaults({
                id: exercise.id || `exercise_${importStamp}_${microcycleIndex}_${weekIndex}_${workoutIndex}_${exerciseIndex}`,
                name: exercise.name || "Упражнение",
                video: exercise.video || exercise.videoUrl || exercise.videoURL || "",
                requiresWeight: exercise.requiresWeight,
                sets: Array.isArray(exercise.sets) && exercise.sets.length
                  ? exercise.sets.map((set) => ({
                      reps: set.reps ?? 8,
                      weight: String(set.weight ?? "")
                    }))
                  : [{ reps: 8, weight: "" }]
              }, adminExerciseLibrary)
            )
          }))
        }))
      };
    });
    const monthIds = normalizedBlocks
      .map((microcycle) => microcycle.monthId)
      .filter((monthId, index, items) => items.indexOf(monthId) === index);
    const months = monthIds.map((monthId, monthIndex) => {
      const sourceMonth = importedMonths.find((month, sourceMonthIndex) =>
        (month.id || `month_${sourceMonthIndex + 1}`) === monthId
      );

      return {
        id: monthId,
        name: String(sourceMonth?.name || `Месяц ${monthIndex + 1}`)
          .replace(/^Блок\s+Месяц/i, "Месяц"),
        microcycles: normalizedBlocks.filter((microcycle) => microcycle.monthId === monthId)
      };
    });

    return normalizeMonthProgram({
      id: rawProgram.id || `imported_${Date.now()}`,
      name: rawProgram.name || "Импортированная программа",
      description: rawProgram.description || "",
      rules: rawProgram.rules || {},
      months,
      blocks: normalizedBlocks
    });
  }

  function normalizeImportedExcelProgram(sheets = [], fileName = "Программа") {
    const importStamp = Date.now();
    const importedMicrocycles = [];
    const cleanCell = (value) => String(value ?? "").trim();
    const readNumber = (value, fallback) => {
      const match = cleanCell(value).replace(",", ".").match(/\d+(?:\.\d+)?/);
      const parsed = Number(match?.[0]);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    sheets.forEach((sheetEntry, sheetIndex) => {
      const sheetName = cleanCell(sheetEntry.sheet || `Лист ${sheetIndex + 1}`);
      const rows = Array.isArray(sheetEntry.data) ? sheetEntry.data : [];
      const sheetMicrocycleMatch = sheetName.match(/микроцикл\s*(\d+)/i);
      const sheetMonthMatch = sheetName.match(/месяц\s*(\d+)/i);
      const sheetWeekRangeMatch = sheetName.match(/недел(?:я|и)\s*(\d+)\s*[-–—]\s*(\d+)/i);
      const sheetWeekMatch = sheetName.match(/недел(?:я|и)\s*(\d+)/i);
      let microcycleNumber = Number(sheetMicrocycleMatch?.[1]) || 0;
      let monthNumber = Number(sheetMonthMatch?.[1]) || 0;
      let explicitWeekNumber = sheetWeekRangeMatch ? 0 : (Number(sheetWeekMatch?.[1]) || 0);
      let exerciseColumn = 0;
      let setsColumn = 1;
      let repsColumn = 2;
      let weightColumn = 3;
      let currentWorkout = null;
      const sharedWorkouts = [];
      const workoutsByWeek = new Map();

      rows.forEach((row) => {
        const cells = Array.isArray(row) ? row : [];
        const firstValue = cleanCell(cells.find((cell) => cleanCell(cell)));
        if (!firstValue) {
          currentWorkout = null;
          return;
        }

        const headerCells = cells.map((cell) => cleanCell(cell).toLocaleLowerCase("ru"));
        const exerciseHeader = headerCells.findIndex((value) => value.includes("упражнен"));
        if (exerciseHeader >= 0) {
          exerciseColumn = exerciseHeader;
          const nextSetsColumn = headerCells.findIndex((value) => value.includes("подход"));
          const nextRepsColumn = headerCells.findIndex((value) => value.includes("повтор"));
          const nextWeightColumn = headerCells.findIndex((value) => value.includes("вес"));
          if (nextSetsColumn >= 0) setsColumn = nextSetsColumn;
          if (nextRepsColumn >= 0) repsColumn = nextRepsColumn;
          if (nextWeightColumn >= 0) weightColumn = nextWeightColumn;
          return;
        }

        const monthMatch = firstValue.match(/^месяц\s*(\d+)/i);
        if (monthMatch) {
          monthNumber = Number(monthMatch[1]);
          currentWorkout = null;
          return;
        }

        const microcycleMatch = firstValue.match(/^микроцикл\s*(\d+)/i);
        if (microcycleMatch) {
          microcycleNumber = Number(microcycleMatch[1]);
          currentWorkout = null;
          return;
        }

        const weekMatch = firstValue.match(/^недел(?:я|и)\s*(\d+)/i);
        if (weekMatch) {
          explicitWeekNumber = Number(weekMatch[1]);
          currentWorkout = null;
          return;
        }

        const workoutMatch = firstValue.match(/^(?:день|тренировка)\s*(\d+)/i);
        if (workoutMatch) {
          currentWorkout = {
            dayNumber: Number(workoutMatch[1]),
            name: firstValue,
            exercises: []
          };
          if (explicitWeekNumber) {
            const weekWorkouts = workoutsByWeek.get(explicitWeekNumber) || [];
            weekWorkouts.push(currentWorkout);
            workoutsByWeek.set(explicitWeekNumber, weekWorkouts);
          } else {
            sharedWorkouts.push(currentWorkout);
          }
          return;
        }

        if (!currentWorkout) return;
        const exerciseName = cleanCell(cells[exerciseColumn]);
        if (!exerciseName) return;
        const setsCount = Math.max(1, Math.round(readNumber(cells[setsColumn], 3)));
        const reps = cleanCell(cells[repsColumn]) || "8";
        const weight = cleanCell(cells[weightColumn]);
        currentWorkout.exercises.push(applyExerciseLibraryDefaults({
          name: exerciseName,
          sets: Array.from({ length: setsCount }, () => ({ reps, weight }))
        }, adminExerciseLibrary));
      });

      const fallbackWeekStart = Math.max(1, microcycleNumber * 2 - 1 || sheetIndex * 2 + 1);
      const weekNumbers = workoutsByWeek.size
        ? [...workoutsByWeek.keys()].sort((a, b) => a - b)
        : sheetWeekRangeMatch
          ? getMicrocycleWeekNumbers(
              microcycleNumber || sheetIndex + 1,
              sheetWeekRangeMatch[1],
              sheetWeekRangeMatch[2]
            )
          : [explicitWeekNumber || fallbackWeekStart, explicitWeekNumber ? null : fallbackWeekStart + 1].filter(Boolean);

      if (!microcycleNumber) {
        microcycleNumber = Math.ceil((weekNumbers[0] || fallbackWeekStart) / 2);
      }
      if (!monthNumber) {
        monthNumber = Math.ceil(microcycleNumber / 2);
      }

      const sharedWorkoutsByWeek = distributeMicrocycleWorkouts(sharedWorkouts, weekNumbers.length);
      const weeks = weekNumbers.map((weekNumber, weekIndex) => {
        const workoutTemplates = workoutsByWeek.get(weekNumber) || sharedWorkoutsByWeek[weekIndex] || [];
        return {
          id: `week_${importStamp}_${microcycleNumber}_${weekNumber}`,
          name: `Неделя ${weekNumber}`,
          workouts: workoutTemplates.map((workout, workoutIndex) => ({
            id: `workout_${importStamp}_${microcycleNumber}_${weekNumber}_${workoutIndex}`,
            name: `Тренировка ${(weekNumber - 1) * 2 + workoutIndex + 1}`,
            exercises: workout.exercises.map((exercise, exerciseIndex) => ({
              ...exercise,
              id: `exercise_${importStamp}_${microcycleNumber}_${weekNumber}_${workoutIndex}_${exerciseIndex}`,
              sets: exercise.sets.map((set, setIndex) => ({
                ...set,
                id: `set_${importStamp}_${microcycleNumber}_${weekNumber}_${workoutIndex}_${exerciseIndex}_${setIndex}`
              }))
            }))
          }))
        };
      });

      if (weeks.some((week) => week.workouts.length)) {
        importedMicrocycles.push({
          id: `microcycle_${importStamp}_${microcycleNumber}`,
          name: `Микроцикл ${microcycleNumber}`,
          monthId: `month_${monthNumber}`,
          weeks
        });
      }
    });

    if (!importedMicrocycles.length) {
      throw new Error("В Excel не найдены тренировки и упражнения.");
    }

    const monthIds = importedMicrocycles
      .map((microcycle) => microcycle.monthId)
      .filter((monthId, index, items) => items.indexOf(monthId) === index);
    const months = monthIds.map((monthId) => {
      const monthNumber = Number(String(monthId).match(/\d+/)?.[0]) || 1;
      return {
        id: monthId,
        name: `Месяц ${monthNumber}`,
        microcycles: importedMicrocycles.filter((microcycle) => microcycle.monthId === monthId)
      };
    });

    return normalizeMonthProgram({
      id: `excel_${importStamp}`,
      name: fileName.replace(/\.xlsx$/i, "") || "Импортированная программа",
      description: "Импортировано из Excel",
      months,
      blocks: importedMicrocycles
    });
  }

  return {
    normalizeImportedExcelProgram,
    normalizeImportedMonthlyProgram
  };
}
