export function normalizeTrainerMonthProgram(program = {}, options = {}) {
  const getNowIso = typeof options.getNowIso === "function"
    ? options.getNowIso
    : () => new Date().toISOString();
  const getFallbackId = typeof options.getFallbackId === "function"
    ? options.getFallbackId
    : () => `month_${Date.now()}`;
  const sourceMonths = Array.isArray(program.months) ? program.months : [];
  const nestedMicrocycles = sourceMonths.flatMap((month, monthIndex) =>
    (Array.isArray(month.microcycles) ? month.microcycles : (month.blocks || [])).map((microcycle) => ({
      ...microcycle,
      monthId: microcycle.monthId || month.id || `month_${monthIndex + 1}`
    }))
  );
  const sourceBlocks = Array.isArray(program.blocks)
    ? program.blocks
    : nestedMicrocycles;
  const hasStructuredHierarchy = sourceMonths.some((month) =>
    Array.isArray(month.microcycles) || Array.isArray(month.blocks)
  ) || (Array.isArray(program.months) && Array.isArray(program.blocks));
  const blockCount = sourceBlocks.length || (hasStructuredHierarchy ? 0 : 2);
  const blocks = Array.from({ length: blockCount }, (_, blockIndex) => {
    const sourceBlock = sourceBlocks[blockIndex] || {};
    const sourceWeeks = Array.isArray(sourceBlock.weeks)
      ? sourceBlock.weeks
      : [{}, {}];
    const sourceName = String(sourceBlock.name || "").trim();

    return {
      id: sourceBlock.id || `microcycle_${blockIndex + 1}`,
      name: sourceName
        ? sourceName.replace(/^Блок(?=\s*\d)/i, "Микроцикл")
        : `Микроцикл ${blockIndex + 1}`,
      monthId: sourceBlock.monthId || `month_${Math.floor(blockIndex / 2) + 1}`,
      weeks: Array.from({ length: sourceWeeks.length }, (_, weekOffset) => {
        const sourceWeek = sourceWeeks[weekOffset] || {};
        const absoluteWeek = blockIndex * 2 + weekOffset + 1;
        return {
          id: sourceWeek.id || `week_${absoluteWeek}`,
          name: sourceWeek.name || `Неделя ${absoluteWeek}`,
          workouts: sourceWeek.workouts || []
        };
      })
    };
  });
  const sourceMonthIds = sourceMonths.map((month, monthIndex) => month.id || `month_${monthIndex + 1}`);
  const monthIds = [
    ...sourceMonthIds,
    ...blocks.map((block) => block.monthId).filter((monthId) => !sourceMonthIds.includes(monthId))
  ].filter((monthId, index, items) => monthId && items.indexOf(monthId) === index);
  const months = monthIds.map((monthId, monthIndex) => {
    const sourceMonth = sourceMonths.find((month, sourceMonthIndex) =>
      (month.id || `month_${sourceMonthIndex + 1}`) === monthId
    );
    const sourceName = String(sourceMonth?.name || "").trim();

    return {
      id: monthId,
      name: sourceName
        ? sourceName.replace(/^Блок\s+Месяц/i, "Месяц")
        : `Месяц ${monthIndex + 1}`,
      microcycles: blocks.filter((block) => block.monthId === monthId)
    };
  });

  return {
    id: program.id || getFallbackId(),
    name: program.name || "Программа на месяц",
    description: program.description || "",
    ownerUid: program.ownerUid || "",
    ownerRole: program.ownerRole || "",
    createdByUid: program.createdByUid || "",
    updatedByUid: program.updatedByUid || "",
    createdAt: program.createdAt || getNowIso(),
    updatedAt: getNowIso(),
    blocks,
    months
  };
}
