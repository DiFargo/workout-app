export function getDashboardEmptyWorkoutAction(mode, hasPlanInAnotherMode = false) {
  if (hasPlanInAnotherMode) return {
    state: "choose", title: "Выберите режим тренировок",
    dateText: "План уже есть в другом режиме. Выберите, какой открыть.", actionLabel: "Выбрать режим"
  };
  return mode === "basic" ? {
    state: "create", title: "Подготовьте базовую тренировку",
    dateText: "Откройте базовые тренировки, чтобы настроить свой план.", actionLabel: "Открыть базовые тренировки"
  } : {
    state: "awaiting-trainer", title: "Ожидаем программу тренера",
    dateText: "Индивидуальная программа ещё не назначена. Уточните её у тренера.", actionLabel: "Открыть тренировки"
  };
}

export function runDashboardWorkoutAction(state, { openModePicker, openTraining }) {
  return state === "choose" ? openModePicker() : openTraining();
}

export function isDashboardNutritionDayKnown({ ready, coverage, nutrition, dayKey, uid } = {}) {
  if (!uid || !dayKey || nutrition?.__uid && nutrition.__uid !== uid) return false;
  const scope = nutrition?.__nutritionStorage;
  const matchingCoverage = coverage?.uid === uid && (!scope ||
    coverage.generation === scope.generation && coverage.writerEpoch === scope.writerEpoch);
  if (ready && matchingCoverage && (coverage.historyComplete || coverage.complete ||
    coverage.loadedDayKeys?.includes(dayKey) || coverage.missingDayKeys?.includes(dayKey))) return true;
  const localDay = nutrition?.__uid === uid ? nutrition.days?.[dayKey] : null;
  // A cache for another date, or a newly constructed empty day, is not proof
  // that today's cloud diary contains zero calories.
  return Boolean(localDay && (localDay.updatedAt || localDay.foods?.length));
}

export function getDashboardWeightPresentation({ weight, change, comparisonAvailable = false,
  dateText = "", loadState = "ready", hasLoadedData = true } = {}) {
  const value = Number(weight);
  const hasWeight = Number.isFinite(value) && value > 0;
  if (!hasLoadedData && loadState !== "ready") return {
    value: loadState === "error" ? "—" : "…",
    note: loadState === "error" ? "Не удалось загрузить" : "Загружаем вес…"
  };
  if (!hasWeight) return { value: "—", note: "Добавьте первый вес" };
  const delta = Number(change);
  const comparison = comparisonAvailable && Number.isFinite(delta)
    ? delta === 0 ? "Без изменений" : `${delta > 0 ? "+" : ""}${delta.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} кг`
    : "Пока без сравнения";
  return { value: value.toLocaleString("ru-RU", { maximumFractionDigits: 1 }),
    note: dateText ? `${comparison} · ${dateText}` : comparison };
}
