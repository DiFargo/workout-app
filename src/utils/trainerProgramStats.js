function getTemplateBlocks(template = {}) {
  return (template.blocks || []).length
    ? template.blocks
    : (template.months || []).flatMap((month) => month.microcycles || month.blocks || []);
}

export function getTrainerProgramTemplateStats(template = {}) {
  const templateBlocks = getTemplateBlocks(template);
  const workouts = Array.isArray(template.workouts)
    ? template.workouts
    : templateBlocks.flatMap((block) =>
        (block.weeks || []).flatMap((week) => week.workouts || [])
      );

  const exercisesCount = workouts.reduce((sum, workout) => sum + ((workout.exercises || []).length), 0);
  const weeksCount = templateBlocks.reduce((sum, block) => sum + ((block.weeks || []).length), 0);

  return {
    workoutsCount: workouts.length,
    exercisesCount,
    weeksCount: weeksCount || 4,
    blocksCount: templateBlocks.length || 1
  };
}
