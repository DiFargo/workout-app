export function createTrainerMonthProgramStructureHandlers({
  adminActiveDayId,
  adminOpenWorkoutId,
  adminProgramCopyTarget,
  monthBlocks,
  monthGroups,
  monthWorkouts,
  setAdminActiveDayId,
  setAdminOpenProgramBlocks,
  setAdminOpenProgramWeeks,
  setAdminOpenWorkoutId,
  setAdminProgramCopyTarget,
  setAdminProgramSwipeOpenKey,
  setAdminSelectedExerciseId,
  setMonthProgram,
  showAppConfirm
}) {
  function updateMonthProgramName(name) {
    setMonthProgram((program) => ({ ...program, name }));
  }

  function addProgramMonth() {
    setMonthProgram((program) => {
      const nextMonthNumber = (program.months || []).reduce((maxNumber, month, index) => {
        const monthNumber = Number(String(month.name || "").match(/Месяц\s+(\d+)/i)?.[1]) || index + 1;
        return Math.max(maxNumber, monthNumber);
      }, 0) + 1;
      const monthId = `month_${Date.now()}`;

      return {
        ...program,
        months: [
          ...(program.months || []),
          {
            id: monthId,
            name: `Месяц ${nextMonthNumber}`,
            microcycles: []
          }
        ]
      };
    });
  }

  function updateProgramMonth(monthId, patch = {}) {
    setMonthProgram((program) => ({
      ...program,
      months: (program.months || []).map((month) =>
        month.id === monthId ? { ...month, ...patch } : month
      )
    }));
  }

  async function removeProgramMonth(monthId) {
    const month = monthGroups.find((item) => item.id === monthId);
    if (!month) return;
    if (!(await showAppConfirm(`Удалить «${month.name || "Месяц"}» со всеми микроциклами, неделями и тренировками?`))) {
      return;
    }

    const removedBlockIds = new Set(
      (month.microcycles || month.blocks || []).map((block) => block.id)
    );
    const removedWorkoutIds = new Set(
      (month.microcycles || month.blocks || []).flatMap((block) =>
        (block.weeks || []).flatMap((week) =>
          (week.workouts || []).map((workout) => workout.id)
        )
      )
    );

    setMonthProgram((program) => ({
      ...program,
      months: (program.months || []).filter((item) => item.id !== monthId),
      blocks: (program.blocks || []).filter((block) => !removedBlockIds.has(block.id))
    }));

    if (removedWorkoutIds.has(adminOpenWorkoutId)) {
      setAdminOpenWorkoutId("");
      setAdminSelectedExerciseId("");
    }
  }

  function addMonthBlock(monthId = "month_1") {
    setMonthProgram((program) => {
      const nextBlockNumber = program.blocks.reduce((maxNumber, block) => {
        const blockNumber = Number(String(block.name || "").match(/^(?:Микроцикл|Блок)\s+(\d+)/i)?.[1]) || 0;
        return Math.max(maxNumber, blockNumber);
      }, 0) + 1;

      return {
        ...program,
        blocks: [
          ...program.blocks,
          {
            id: `microcycle_${Date.now()}`,
            name: `Микроцикл ${nextBlockNumber}`,
            monthId,
            weeks: []
          }
        ]
      };
    });
  }

  function addMonthWeek(blockId) {
    setMonthProgram((program) => {
      const nextWeekNumber = program.blocks.reduce((maxNumber, block) =>
        (block.weeks || []).reduce((weekMax, week) => {
          const weekNumber = Number(String(week.name || "").match(/^Неделя\s+(\d+)/i)?.[1]) || 0;
          return Math.max(weekMax, weekNumber);
        }, maxNumber), 0) + 1;
      return {
        ...program,
        blocks: program.blocks.map((block) => block.id !== blockId ? block : {
          ...block,
          weeks: [
            ...(block.weeks || []),
            { id: `week_${Date.now()}`, name: `Неделя ${nextWeekNumber}`, workouts: [] }
          ]
        })
      };
    });
    setAdminOpenProgramBlocks((current) => ({ ...current, [blockId]: true }));
  }

  function openCopyMonthProgramBlock(blockId) {
    const sourceBlock = monthBlocks.find((block) => block.id === blockId);
    if (!sourceBlock) return;

    setAdminProgramCopyTarget({
      blockId
    });
  }

  function copyMonthProgramBlock(blockId, targetMonthId, afterBlockId = "") {
    setMonthProgram((program) => {
      const sourceBlock = program.blocks.find((block) => block.id === blockId);
      if (!sourceBlock) return program;

      const stamp = Date.now();
      const copiedBlock = {
        ...sourceBlock,
        id: `microcycle_${stamp}`,
        name: `${sourceBlock.name || "Микроцикл"} — копия`,
        monthId: targetMonthId,
        weeks: (sourceBlock.weeks || []).map((week, weekIndex) => ({
          ...week,
          id: `week_${stamp}_${weekIndex}`,
          workouts: (week.workouts || []).map((workout, workoutIndex) => ({
            ...workout,
            id: `workout_${stamp}_${weekIndex}_${workoutIndex}`,
            exercises: (workout.exercises || []).map((exercise, exerciseIndex) => ({
              ...exercise,
              id: `exercise_${stamp}_${weekIndex}_${workoutIndex}_${exerciseIndex}`,
              sets: (exercise.sets || []).map((set, setIndex) => ({
                ...set,
                ...(set?.id ? { id: `set_${stamp}_${weekIndex}_${workoutIndex}_${exerciseIndex}_${setIndex}` } : {})
              }))
            }))
          }))
        }))
      };
      const nextBlocks = [...program.blocks];
      const targetIndex = afterBlockId
        ? nextBlocks.findIndex((block) => block.id === afterBlockId)
        : nextBlocks.findIndex((block) => block.monthId === targetMonthId) - 1;
      nextBlocks.splice(Math.max(0, targetIndex + 1), 0, copiedBlock);
      return { ...program, blocks: nextBlocks };
    });
    setAdminProgramCopyTarget(null);
  }

  async function removeMonthBlock(blockId) {
    const block = monthBlocks.find((item) => item.id === blockId);
    if (!block) return;
    if (!(await showAppConfirm(`Удалить микроцикл “${block.name || "Без названия"}” со всеми неделями и тренировками?`))) {
      setAdminProgramSwipeOpenKey("");
      return;
    }

    const removedWeekIds = new Set((block.weeks || []).map((week) => week.id));
    const removedWorkoutIds = new Set(
      (block.weeks || []).flatMap((week) => (week.workouts || []).map((workout) => workout.id))
    );
    setMonthProgram((program) => ({
      ...program,
      blocks: program.blocks.filter((item) => item.id !== blockId)
    }));
    setAdminOpenProgramBlocks((current) => {
      const next = { ...current };
      delete next[blockId];
      return next;
    });
    setAdminOpenProgramWeeks((current) => Object.fromEntries(
      Object.entries(current).filter(([weekId]) => !removedWeekIds.has(weekId))
    ));
    if (removedWorkoutIds.has(adminOpenWorkoutId)) {
      setAdminOpenWorkoutId("");
      setAdminSelectedExerciseId("");
    }
    if (removedWorkoutIds.has(adminActiveDayId)) {
      setAdminActiveDayId("");
    }
    if (adminProgramCopyTarget?.blockId === blockId) {
      setAdminProgramCopyTarget(null);
    }
    setAdminProgramSwipeOpenKey("");
  }

  async function removeMonthWeek(blockId, weekId) {
    const block = monthBlocks.find((item) => item.id === blockId);
    const week = block?.weeks?.find((item) => item.id === weekId);
    if (!week) return;
    if (!(await showAppConfirm(`Удалить “${week.name || "Неделя"}” со всеми днями?`))) {
      setAdminProgramSwipeOpenKey("");
      return;
    }

    const removedWorkoutIds = new Set((week.workouts || []).map((workout) => workout.id));
    setMonthProgram((program) => ({
      ...program,
      blocks: program.blocks.map((item) => item.id !== blockId ? item : {
        ...item,
        weeks: (item.weeks || []).filter((entry) => entry.id !== weekId)
      })
    }));
    setAdminOpenProgramWeeks((current) => {
      const next = { ...current };
      delete next[weekId];
      return next;
    });
    if (removedWorkoutIds.has(adminOpenWorkoutId)) {
      setAdminOpenWorkoutId("");
      setAdminSelectedExerciseId("");
    }
    if (removedWorkoutIds.has(adminActiveDayId)) {
      setAdminActiveDayId("");
    }
    setAdminProgramSwipeOpenKey("");
  }

  function removeMonthWorkout(blockId, weekId, workoutId) {
    setMonthProgram((program) => ({
      ...program,
      blocks: program.blocks.map((block) => block.id !== blockId ? block : {
        ...block,
        weeks: block.weeks.map((week) => week.id !== weekId ? week : {
          ...week,
          workouts: (week.workouts || []).filter((workout) => workout.id !== workoutId)
        })
      })
    }));
    if (adminOpenWorkoutId === workoutId) {
      setAdminOpenWorkoutId("");
      setAdminSelectedExerciseId("");
    }
    if (adminActiveDayId === workoutId) {
      setAdminActiveDayId("");
    }
  }

  async function confirmRemoveMonthWorkout(blockId, weekId, workoutId) {
    const workout = monthWorkouts.find((item) => item.id === workoutId);
    if (!workout) return;
    if (!(await showAppConfirm(`Удалить тренировку “${workout.name || "Без названия"}”?`))) {
      setAdminProgramSwipeOpenKey("");
      return;
    }

    removeMonthWorkout(blockId, weekId, workoutId);
    setAdminProgramSwipeOpenKey("");
  }

  function toggleMonthProgramBlock(blockId) {
    setAdminOpenProgramBlocks((current) => ({
      ...current,
      [blockId]: !current[blockId]
    }));
  }

  function toggleMonthProgramWeek(weekId) {
    setAdminOpenProgramWeeks((current) => ({
      ...current,
      [weekId]: !current[weekId]
    }));
  }

  function addMonthWorkout(blockId, weekId) {
    const newWorkoutId = `workout_${Date.now()}`;

    setMonthProgram((program) => ({
      ...program,
      blocks: program.blocks.map((block) => block.id !== blockId ? block : {
        ...block,
        weeks: block.weeks.map((week) => {
          if (week.id !== weekId) return week;
          const nextWorkoutNumber = (week.workouts || []).reduce((maxNumber, workout) => {
            const workoutNumber = Number(String(workout.name || "").match(/Тренировка\s+(\d+)/i)?.[1]) || 0;
            return Math.max(maxNumber, workoutNumber);
          }, 0) + 1;
          return {
            ...week,
            workouts: [
              ...(week.workouts || []),
              {
                id: newWorkoutId,
                name: `${week.name} — Тренировка ${nextWorkoutNumber}`,
                exercises: []
              }
            ]
          };
        })
      })
    }));

    setAdminOpenProgramBlocks((current) => ({ ...current, [blockId]: true }));
    setAdminOpenProgramWeeks((current) => ({ ...current, [weekId]: true }));
    setAdminOpenWorkoutId(newWorkoutId);
    setAdminSelectedExerciseId("");
  }

  function duplicateMonthWorkout(blockId, weekId, workoutId) {
    const sourceWorkout = monthWorkouts.find((workout) => workout.id === workoutId);
    if (!sourceWorkout) return;
    const stamp = Date.now();
    const duplicatedWorkout = {
      ...sourceWorkout,
      id: `workout_${stamp}`,
      name: `${sourceWorkout.name || "Тренировка"} — копия`,
      exercises: (sourceWorkout.exercises || []).map((exercise, exerciseIndex) => ({
        ...exercise,
        id: `exercise_${stamp}_${exerciseIndex}`,
        sets: (exercise.sets || []).map((set, setIndex) => ({
          ...set,
          ...(set?.id ? { id: `set_${stamp}_${exerciseIndex}_${setIndex}` } : {})
        }))
      }))
    };

    setMonthProgram((program) => ({
      ...program,
      blocks: program.blocks.map((block) => block.id !== blockId ? block : {
        ...block,
        weeks: block.weeks.map((week) => week.id !== weekId ? week : {
          ...week,
          workouts: (week.workouts || []).flatMap((workout) =>
            workout.id === workoutId ? [workout, duplicatedWorkout] : [workout]
          )
        })
      })
    }));
    setAdminOpenWorkoutId(duplicatedWorkout.id);
    setAdminSelectedExerciseId("");
  }

  return {
    addMonthBlock,
    addMonthWeek,
    addMonthWorkout,
    addProgramMonth,
    confirmRemoveMonthWorkout,
    copyMonthProgramBlock,
    duplicateMonthWorkout,
    openCopyMonthProgramBlock,
    removeMonthBlock,
    removeMonthWeek,
    removeProgramMonth,
    toggleMonthProgramBlock,
    toggleMonthProgramWeek,
    updateMonthProgramName,
    updateProgramMonth
  };
}
