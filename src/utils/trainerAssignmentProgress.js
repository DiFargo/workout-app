import { getExerciseActualProgress } from "./exerciseProgress.js";

const NON_WORK_TYPES = new Set(["warmup", "warm-up", "разминка", "разминочный"]);
const preparedHistories = new WeakMap();
const status = (key, label, tone, description) => ({ key, label, tone, description });

function number(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const text = String(value).trim().replace(",", ".");
  if (!text || !/^\d+(?:\.\d+)?$/.test(text)) return null;
  const result = Number(text);
  return Number.isFinite(result) && result >= 0 ? result : null;
}

function repRange(value) {
  if (Array.isArray(value)) {
    const values = value.map(number);
    return values.length && values.every(item => item > 0)
      ? { min: Math.min(...values), max: Math.max(...values) } : null;
  }
  if (value && typeof value === "object") {
    const min = number(value.min ?? value.from ?? value.start);
    const max = number(value.max ?? value.to ?? value.end);
    return min > 0 && max >= min ? { min, max } : null;
  }
  const values = String(value ?? "").trim().split(/\s*[-–—]\s*/);
  if (values.length > 2) return null;
  const min = number(values[0]);
  const max = number(values.at(-1));
  return min > 0 && max >= min ? { min, max } : null;
}

export function formatTrainerProgressNumber(value) {
  return Number.isFinite(value) ? String(Math.round(value * 10) / 10).replace(".", ",") : "—";
}

function signed(value) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatTrainerProgressNumber(Math.abs(value))}`;
}

function workingPlans(session) {
  return (session.plannedSets || []).filter(set => !NON_WORK_TYPES.has(String(set.setType || "work").trim().toLowerCase()));
}

function workType(set) {
  const type = String(set.setType || "work").trim().toLowerCase();
  return ["work", "working", "рабочий", "рабочий подход"].includes(type) ? "work" : type;
}

function formatRange(range) {
  if (!range) return "повторы не указаны";
  return range.min === range.max ? formatTrainerProgressNumber(range.min)
    : `${formatTrainerProgressNumber(range.min)}–${formatTrainerProgressNumber(range.max)}`;
}

function formatSet(set, planned = false) {
  const weight = planned ? number(set.weight) : set.weight;
  const reps = planned ? formatRange(repRange(set.reps)) : formatTrainerProgressNumber(set.reps);
  if (weight === null) return `вес не указан × ${reps}`;
  return weight > 0 ? `${formatTrainerProgressNumber(weight)} кг × ${reps}` : `${reps} повт. без доп. веса`;
}

function formatSets(sets, planned = false) {
  const labels = sets.map(set => formatSet(set, planned));
  if (!labels.length) return "Нет выполненных рабочих подходов";
  if (labels.every(label => label === labels[0])) return `${labels.length} подх. · ${labels[0]}`;
  return labels.map((label, index) => `${index + 1}: ${label}`).join("; ");
}

function comparePlan(session, factsComplete) {
  const planned = workingPlans(session);
  const actual = session.actualSets || [];
  if (!planned.length) return status("unknown", "План не сохранён", "neutral", "План этой тренировки не сохранён. Показан только факт.");
  if (!factsComplete) return status("unknown", "Факт неполный", "neutral", "Не для всех рабочих подходов записаны сопоставимые вес и повторы.");
  if (planned.some(set => number(set.weight) === null || !repRange(set.reps))) {
    return status("unknown", "План неполный", "neutral", "В историческом плане не указаны все рабочие веса или повторы. Выполнение плана не оценивается.");
  }
  const validIndices = sets => sets.every(set => Number.isInteger(set.index) && set.index >= 0)
    && new Set(sets.map(set => set.index)).size === sets.length;
  if (!validIndices(planned) || !validIndices(actual)) {
    return status("unknown", "Нет точного сравнения", "neutral", "Не удалось сопоставить исходные номера рабочих подходов.");
  }
  const byIndex = new Map(actual.map(set => [set.index, set]));
  if (actual.length !== planned.length || planned.some(set => !byIndex.has(set.index))) {
    return status("different", "Подходы отличаются", "neutral", `Выполнено ${actual.length} рабочих подходов; в плане ${planned.length}. Полное выполнение плана не подтверждено.`);
  }
  let above = false;
  let below = false;
  for (const plan of planned) {
    const fact = byIndex.get(plan.index);
    if (workType(plan) !== workType(fact)) return status("different", "Типы подходов отличаются", "neutral", "Типы рабочих подходов в плане и факте отличаются. Полное совпадение с планом не подтверждено.");
    const targetWeight = number(plan.weight);
    const range = repRange(plan.reps);
    // The shared history reader represents absent load as zero. Do not turn
    // that into evidence that a prescribed external weight was deliberately reduced.
    if (!Number.isFinite(fact.reps) || fact.reps <= 0 || !Number.isFinite(fact.weight)
      || fact.weight < 0 || (targetWeight > 0 && fact.weight === 0)) {
      return status("unknown", "Факт неполный", "neutral", "Не для всех рабочих подходов записаны сопоставимые вес и повторы.");
    }
    if (fact.weight > targetWeight || fact.reps > range.max) above = true;
    if (fact.weight < targetWeight || fact.reps < range.min) below = true;
  }
  if (above && below) return status("different", "Нагрузка отличается", "neutral", "Часть показателей выше исторического плана, часть ниже. Сравните отдельные подходы.");
  if (above) return status("above", "Выше плана", "neutral", "Все рабочие подходы не ниже исторического плана; вес или повторы в части подходов выше.");
  if (below) return status("below", "Ниже плана", "warning", "В рабочих подходах вес или повторы ниже исторического плана. Это описание факта, не вывод о снижении силы.");
  return status("fulfilled", "План выполнен", "positive", "Все рабочие подходы сопоставлены с историческим планом: веса совпадают, повторы в заданном диапазоне.");
}

function decorate(session, factsComplete) {
  const planned = workingPlans(session);
  const weights = planned.map(set => number(set.weight));
  return {
    ...session,
    factsComplete,
    factText: factsComplete ? formatSets(session.actualSets || [])
      : "Неполная запись рабочих подходов: проверьте вес и повторы в истории",
    planText: planned.length ? formatSets(planned, true) : "План этой тренировки не сохранён",
    planStatus: comparePlan(session, factsComplete),
    chartActualWeight: factsComplete && session.bestWeight > 0 ? session.bestWeight : null,
    chartPlannedWeight: weights.length && weights.every(weight => weight !== null) && Math.max(...weights) > 0
      ? Math.max(...weights) : null
  };
}

// The shared reader intentionally accepts legacy numeric fields. Validate a
// second, non-mutating view so an absent/invalid raw load cannot become an
// explicit zero-load fact and incorrectly satisfy a bodyweight prescription.
function strictHistory(history) {
  const exercises = items => Array.isArray(items) ? items.map(exercise => {
    if (!exercise || typeof exercise !== "object") return exercise;
    const result = { ...exercise };
    for (const key of ["sets", "actualSets", "completedSets", "plannedSets"]) {
      if (!Array.isArray(exercise[key])) continue;
      result[key] = exercise[key].map(set => {
        if (!set || typeof set !== "object") return set;
        const weight = number(set.enteredWeight ?? set.actualWeight ?? set.completedWeight ?? set.resultWeight ?? set.weight);
        const reps = number(set.enteredReps ?? set.actualReps ?? set.completedReps ?? set.resultReps ?? set.reps);
        return weight === null || !(reps > 0) ? { ...set, completed: false } : set;
      });
    }
    return result;
  }) : items;
  return (Array.isArray(history) ? history : []).map(workout => {
    if (!workout || typeof workout !== "object") return workout;
    const result = { ...workout };
    for (const key of ["exercises", "actualExercises", "completedExercises", "exerciseResults", "results"]) {
      if (Array.isArray(workout[key])) result[key] = exercises(workout[key]);
    }
    for (const key of ["workout", "workoutSnapshot", "data"]) {
      if (Array.isArray(workout[key]?.exercises)) result[key] = { ...workout[key], exercises: exercises(workout[key].exercises) };
    }
    return result;
  });
}

/**
 * Prepare once per immutable history reference (for example in useMemo).
 * The opaque, memory-only token cannot be reused with a different history or
 * forged by a caller. Neither the input array nor its records are frozen/changed.
 */
export function prepareTrainerAssignmentProgressHistory(history = []) {
  const prepared = Object.freeze({ history });
  preparedHistories.set(prepared, { history, strict: strictHistory(history) });
  return prepared;
}

function sessionKey(session) {
  return JSON.stringify([session.date.getTime(), session.programId, session.weightConvention,
    session.actualSets.map(set => [set.index, set.weight, set.reps])]);
}

function counts(sessions) {
  const result = new Map();
  sessions.forEach(session => { const key = sessionKey(session); result.set(key, (result.get(key) || 0) + 1); });
  return result;
}

function targetRanges(session) {
  const planned = workingPlans(session);
  const ranges = planned.map(set => repRange(set.reps));
  if (ranges.length && ranges.every(Boolean)) return ranges;
  const direct = session.targetRange;
  return direct && Number.isFinite(direct.min) && Number.isFinite(direct.max) ? [direct] : null;
}

function incomparableReason(previous, current) {
  if (previous.programId && current.programId && previous.programId !== current.programId) return "Изменилась программа.";
  if (previous.weightConvention !== current.weightConvention || previous.bodyweightOnly !== current.bodyweightOnly) {
    return "Изменился способ учёта веса или дополнительной нагрузки.";
  }
  const oldRanges = targetRanges(previous);
  const newRanges = targetRanges(current);
  if (oldRanges && newRanges) {
    const summarize = ranges => ({ min: Math.min(...ranges.map(range => range.min)), max: Math.max(...ranges.map(range => range.max)) });
    const left = summarize(oldRanges);
    const right = summarize(newRanges);
    const changed = left.min !== right.min || left.max !== right.max
      || (oldRanges.length === newRanges.length && oldRanges.some((range, index) => range.min !== newRanges[index].min || range.max !== newRanges[index].max));
    if (changed) return "Изменился плановый диапазон повторений.";
  }
  return "";
}

function direction(previous, current) {
  const differences = [current.totalReps - previous.totalReps, current.sets - previous.sets];
  if (!previous.bodyweightOnly && !current.bodyweightOnly) differences.push(current.bestWeight - previous.bestWeight, current.volume - previous.volume);
  if (differences.every(value => value === 0)) return "same";
  if (differences.every(value => value >= 0)) return "higher";
  if (differences.every(value => value <= 0)) return "lower";
  return "mixed";
}

function samePrescription(previous, current) {
  const left = workingPlans(previous);
  const right = workingPlans(current);
  return left.length > 0 && left.length === right.length && left.every((set, index) => {
    const next = right[index];
    const range = repRange(set.reps);
    const nextRange = repRange(next.reps);
    return range && nextRange && set.index === next.index && workType(set) === workType(next)
      && number(set.weight) !== null && number(set.weight) === number(next.weight)
      && range.min === nextRange.min && range.max === nextRange.max;
  });
}

function compareText(previous, current) {
  const counts = `Повторы: ${previous.totalReps} → ${current.totalReps}; рабочие подходы: ${previous.sets} → ${current.sets}.`;
  if (previous.bodyweightOnly || current.bodyweightOnly) return counts;
  return `Макс. рабочий вес: ${formatTrainerProgressNumber(previous.bestWeight)} → ${formatTrainerProgressNumber(current.bestWeight)} кг (${signed(current.bestWeight - previous.bestWeight)} кг). ${counts}`;
}

/**
 * Assignment-only presentation of recorded facts. The new template is never
 * used to reconstruct an older session's plan or to diagnose physiological regression.
 * chart*Weight are maxima across working sets, not a representative weight × reps × sets.
 */
export function buildTrainerAssignmentProgress(history = [], exercise = {}, prepared = null) {
  const targetExercise = exercise?.sourceExercise || exercise || {};
  const cached = preparedHistories.get(prepared);
  const validatedHistory = cached?.history === history ? cached.strict : strictHistory(history);
  const actual = getExerciseActualProgress(history, targetExercise);
  const valid = getExerciseActualProgress(validatedHistory, targetExercise);
  const rawCounts = counts(actual.sessions);
  const validCounts = counts(valid.sessions);
  const completeFacts = new WeakMap();
  const allSessions = actual.sessions.map(session => {
    const key = sessionKey(session);
    const complete = (validCounts.get(key) || 0) >= rawCounts.get(key);
    const decorated = decorate(session, complete);
    completeFacts.set(decorated, complete);
    return decorated;
  });
  const reasonFor = (left, right) => !completeFacts.get(left) || !completeFacts.get(right)
    ? "Не все фактические рабочие веса и повторы записаны полностью." : incomparableReason(left, right);
  const current = allSessions.at(-1) || null;
  const previous = allSessions.at(-2) || null;
  const sessions = allSessions.slice(-8);
  const planStatus = current?.planStatus || status("unknown", "Нет истории", "neutral", "По упражнению пока нет выполненных рабочих подходов.");
  let trend = status("insufficient", "Нет истории", "neutral", "После выполненной тренировки здесь появится факт.");
  let comparisonText = "Нет выполненных тренировок для сравнения.";
  let baselineText = "План новой программы не используется для оценки прошлых тренировок.";
  let returnToPlan = false;
  if (current && !previous) {
    trend = status("single", "Одна тренировка", "neutral", "Для сравнения нужна ещё одна выполненная тренировка.");
    comparisonText = "Пока есть только одна выполненная тренировка.";
  } else if (previous && current) {
    const reason = reasonFor(previous, current);
    comparisonText = completeFacts.get(previous) && completeFacts.get(current) ? compareText(previous, current)
      : "Факты записаны не полностью; прямое сравнение недоступно.";
    baselineText = "Сравниваются последние две выполненные тренировки, а не план новой программы. Условия, технику и запас повторов оценивает тренер.";
    if (reason) {
      trend = status("incomparable", "Условия изменились", "neutral", `${reason} Факты показаны отдельно; прямой вывод о росте или снижении не делается.`);
    } else {
      const key = direction(previous, current);
      returnToPlan = current.planStatus.key === "fulfilled" && previous.planStatus.key === "above"
        && samePrescription(previous, current);
      const beforePrevious = allSessions.at(-3);
      const repeated = key === "lower" && beforePrevious && !reasonFor(beforePrevious, previous)
        && direction(beforePrevious, previous) === "lower";
      if (repeated) trend = status("repeated_lower", "Повторное снижение", "warning", "Показатели ниже в двух последовательных сравнениях. Это не диагноз снижения силы; проверьте контекст тренировок.");
      else if (key === "lower") trend = status("lower", "Ниже прошлой", "neutral", "Записанные показатели ниже предыдущей тренировки. Одного сравнения недостаточно для вывода о снижении силы.");
      else if (key === "higher") trend = status("higher", "Выше прошлой", "positive", "Записанные показатели выше предыдущей тренировки. Сравните условия выполнения.");
      else if (key === "mixed") trend = status("mixed", "Разные изменения", "neutral", "Часть показателей выросла, часть снизилась. Смотрите веса, повторы и число подходов отдельно.");
      else trend = status("same", "Без изменений", "neutral", "Записанные вес, повторы, число подходов и объём не изменились. Запас повторов и техника здесь не оцениваются.");
      if (returnToPlan) trend = { ...trend, description: "Последняя тренировка выполнена по своему историческому плану; предыдущая была выше своего плана. Снижение относительно неё может быть возвратом к плановой нагрузке." };
    }
  }
  const firstShown = sessions[0];
  if (sessions.length >= 3 && sessions.every((session, index) => index === 0
    || (!reasonFor(sessions[index - 1], session) && !reasonFor(firstShown, session)))) {
    const date = firstShown.date.toLocaleDateString("ru-RU");
    const unchanged = direction(firstShown, current) === "same" ? "без изменений. " : "";
    baselineText = `К первой из показанных (${date}): ${unchanged}${compareText(firstShown, current)}`;
  }
  return { sessions, sessionCount: actual.sessionCount, current, previous, planStatus,
    comparisonText, baselineText, trend, returnToPlan };
}
