import { getTrainerSummaryTimestamp } from "./trainerSummaryDates.js";

const numberFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
const dateFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });
const monthFormat = new Intl.DateTimeFormat("ru-RU", { month: "short" });

function text(value) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function normalize(value) {
  return text(value).normalize("NFKC").toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

function numeric(value) {
  if (value === "" || value === null || value === undefined || typeof value === "boolean") return null;
  const result = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(result) && result >= 0 ? result : null;
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function exerciseName(exercise) {
  return text(exercise.name || exercise.exerciseName || exercise.title) || "Упражнение без названия";
}

function exerciseIdentities(exercise) {
  const keys = ["id", "exerciseId", "sourceExerciseId", "originalExerciseId", "libraryExerciseId", "basicExerciseId", "sourceId"]
    .map((field) => text(exercise[field])).filter(Boolean).map((value) => `id:${value}`);
  if (exercise.exerciseCardId) keys.push(`card:${text(exercise.exerciseCardOwnerUid)}:${text(exercise.exerciseCardId)}`);
  return new Set(keys);
}

function setsOf(exercise) {
  return [exercise.sets, exercise.actualSets, exercise.completedSets].find(Array.isArray) || [];
}

function actualSet(set, position) {
  const reps = numeric(firstValue(set.enteredReps, set.actualReps, set.completedReps, set.resultReps, set.reps));
  const weight = numeric(firstValue(set.enteredWeight, set.actualWeight, set.completedWeight, set.resultWeight, set.weight));
  const duration = numeric(firstValue(set.enteredDurationSeconds, set.actualDurationSeconds, set.completedDurationSeconds, set.durationSeconds));
  // Modern history has an explicit completion flag. Never let remaining
  // prescription values turn an explicitly unfinished set into a result.
  const completed = set.completed !== false && (set.completed === true || reps > 0 || duration > 0 || weight > 0);
  const savedNumber = numeric(set.set);
  const number = Number.isInteger(savedNumber) && savedNumber > 0 ? savedNumber : position;
  return { number, reps, weight, duration, completed, explicitIncomplete: set.completed === false };
}

function formatSet({ reps, weight, duration }) {
  if (duration > 0) return `${numberFormat.format(duration)} с`;
  if (reps !== null && weight !== null) return `${numberFormat.format(weight)} кг × ${numberFormat.format(reps)}`;
  if (reps !== null) return `${numberFormat.format(reps)} повт.`;
  if (weight !== null) return `${numberFormat.format(weight)} кг`;
  return "—";
}

function summarizeSets(sets, allowCompact) {
  if (!sets.length) return "—";
  const values = sets.map(formatSet);
  if (allowCompact && values.every((value) => value === values[0])) return `${sets.length} подх. · ${values[0]}`;
  return values.map((value, index) => `${sets[index].number}: ${value}`).join("; ");
}

function plannedSets(exercise) {
  const sets = [exercise.sets, exercise.plannedSets].find(Array.isArray);
  if (sets?.length) return sets.filter((set) => set && typeof set === "object").map((set) => ({
    reps: firstValue(set.targetReps, set.reps) ?? null,
    weight: numeric(firstValue(set.targetWeight, set.weight)),
    duration: numeric(firstValue(set.targetDurationSeconds, set.durationSeconds))
  }));
  const count = numeric(exercise.setCount ?? exercise.setsCount ?? exercise.sets);
  if (!count || !Number.isInteger(count) || count > 100) return [];
  return Array.from({ length: count }, () => ({ reps: firstValue(exercise.targetReps, exercise.reps) ?? null,
    weight: numeric(firstValue(exercise.targetWeight, exercise.weight)), duration: numeric(exercise.durationSeconds) }));
}

function summarizePlan(exercise) {
  if (!exercise) return "—";
  const sets = plannedSets(exercise);
  if (!sets.length) return "Подходы не указаны";
  // A prescription may contain a repetition range, unlike a recorded result.
  const values = sets.map((set) => set.duration > 0 ? `${numberFormat.format(set.duration)} с`
    : set.reps !== null && set.weight !== null ? `${numberFormat.format(set.weight)} кг × ${text(set.reps)}`
      : set.reps !== null ? `${text(set.reps)} повт.` : set.weight !== null ? `${numberFormat.format(set.weight)} кг` : "—");
  return values.every((value) => value === values[0]) ? `${sets.length} подх. · ${values[0]}`
    : values.map((value, index) => `${index + 1}: ${value}`).join("; ");
}

function plural(count, one, few, many) {
  return count % 100 >= 11 && count % 100 <= 14 ? many : count % 10 === 1 ? one : count % 10 >= 2 && count % 10 <= 4 ? few : many;
}

function buildRow(entry, sourceIndex) {
  const timestamp = getTrainerSummaryTimestamp(entry.completedAt || entry.finishedAt || entry.date || entry.createdAt);
  const date = timestamp ? new Date(timestamp) : null;
  const actual = (Array.isArray(entry.exercises) ? entry.exercises : []).filter((exercise) => exercise && typeof exercise === "object");
  const savedPlan = Array.isArray(entry.plannedSnapshot?.exercises) ? entry.plannedSnapshot.exercises
    : Array.isArray(entry.plannedExercises) ? entry.plannedExercises : null;
  const plan = (savedPlan || []).filter((exercise) => exercise && typeof exercise === "object");
  const hasSavedPlan = savedPlan !== null;
  const usedPlan = new Set();
  const actualNames = actual.map((exercise) => normalize(exerciseName(exercise)));
  const planNames = plan.map((exercise) => normalize(exerciseName(exercise)));
  const actualIds = actual.map(exerciseIdentities);
  const planIds = plan.map(exerciseIdentities);
  let exercisesCount = 0;
  let setsCount = 0;
  let volume = 0;
  let hasVolume = false;

  const comparison = actual.map((exercise, index) => {
    const recorded = setsOf(exercise).map((set, position) => set && typeof set === "object" ? actualSet(set, position + 1) : null).filter(Boolean);
    const completed = recorded.filter((set) => set.completed);
    const allowCompact = completed.length === recorded.length && recorded.every((set, position) => set.number === position + 1);
    if (completed.length || exercise.completed === true) exercisesCount += 1;
    setsCount += completed.length;
    completed.forEach((set) => {
      if (set.reps !== null && set.weight !== null) { volume += set.reps * set.weight; hasVolume = true; }
    });
    const idCandidates = plan.map((_, planIndex) => planIndex).filter((planIndex) => (
      !usedPlan.has(planIndex) && [...actualIds[index]].some((key) => planIds[planIndex].has(key))
    ));
    let match = idCandidates.length === 1 && actualIds.filter((ids) => [...ids].some((key) => planIds[idCandidates[0]].has(key))).length === 1
      ? idCandidates[0] : -1;
    if (match < 0 && actualNames.filter((name) => name === actualNames[index]).length === 1
      && planNames.filter((name) => name === actualNames[index]).length === 1) {
      const byName = planNames.indexOf(actualNames[index]);
      if (!usedPlan.has(byName)) match = byName;
    }
    if (match >= 0) usedPlan.add(match);
    const prescribed = match >= 0 ? plan[match] : null;
    const notes = [];
    if (prescribed && normalize(exerciseName(prescribed)) !== actualNames[index]) notes.push(`В плане: ${exerciseName(prescribed)}`);
    if (hasSavedPlan && !prescribed) notes.push("Нет однозначного соответствия в сохранённом плане");
    if (recorded.some((set) => set.explicitIncomplete)) notes.push("Не все подходы отмечены выполненными");
    const clientNote = text(exercise.clientNote);
    if (clientNote) notes.push(`Заметка клиента: ${clientNote}`);
    return {
      key: `${text(exercise.id || exercise.exerciseId) || "exercise"}:${index}`,
      name: exerciseName(exercise), plannedText: summarizePlan(prescribed),
      actualText: completed.length ? summarizeSets(completed, allowCompact) : exercise.completed === true ? "Отмечено выполненным; подходы не записаны"
        : recorded.some((set) => set.explicitIncomplete) ? "Не выполнено" : "—",
      note: notes.join(". ")
    };
  });
  const duration = numeric(entry.durationSeconds);
  const durationText = duration > 0 ? `${Math.max(1, Math.round(duration / 60))} мин` : "";
  const summary = `${exercisesCount} ${plural(exercisesCount, "упражнение", "упражнения", "упражнений")} · ${setsCount} ${plural(setsCount, "подход", "подхода", "подходов")}`;
  return {
    key: `${text(entry.id || entry.clientSaveId || entry.workoutId) || "history"}:${timestamp}:${sourceIndex}`,
    entry, title: [entry.workoutName, entry.workout, entry.name, entry.title].map(text).find(Boolean) || "Тренировка",
    dateLabel: date ? dateFormat.format(date) : "Дата не указана",
    dateSearch: date ? `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}` : "",
    dateDay: date ? String(date.getDate()) : "—", dateMonth: date ? monthFormat.format(date) : "",
    programLabel: text(entry.assignedProgramName || entry.programName || entry.planName),
    summary: durationText ? `${durationText} · ${comparison.length ? summary : "Подходы не сохранены"}` : comparison.length ? summary : "Подходы не сохранены",
    feedbackTitle: text(entry.postWorkoutFeedback?.title), clientComment: text(entry.clientComment || entry.comment),
    readinessTitle: text(entry.readiness?.title), volumeLabel: hasVolume ? `${numberFormat.format(volume)} кг` : "—",
    exercisesCount, setsCount, hasSavedPlan, comparison,
    unmatchedPlanNames: plan.filter((_, index) => !usedPlan.has(index)).map(exerciseName)
  };
}

export function buildTrainerWorkoutHistoryRows(history = []) {
  return (Array.isArray(history) ? history : []).filter((entry) => entry && typeof entry === "object")
    .map((entry, index) => ({ row: buildRow(entry, index), timestamp: getTrainerSummaryTimestamp(entry.completedAt || entry.finishedAt || entry.date || entry.createdAt), index }))
    .sort((first, second) => second.timestamp - first.timestamp || first.index - second.index).map(({ row }) => row);
}

export function filterTrainerWorkoutHistoryRows(rows = [], query = "") {
  const terms = normalize(query).split(" ").filter(Boolean);
  if (!terms.length) return rows;
  return rows.filter((row) => {
    const searchable = normalize(`${row.title} ${row.programLabel} ${row.dateLabel} ${row.dateSearch || ""}`);
    return terms.every((term) => searchable.includes(term));
  });
}
