import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertPersonalRepairPreservesResults,
  buildPersonalExerciseHistoryRepair,
  summarizePersonalRepair
} from "../scripts/lib/personalExerciseHistoryRepair.mjs";
import { getExerciseActualProgress } from "../src/utils/exerciseProgress.js";

const PROJECT = "tren-85720";
const UID = "personal-repair-owner";
const ROOT = `projects/${PROJECT}/databases/(default)/documents/users/${UID}`;
const VERSION = "2026-10-28T12:00:00.000Z";
const CURRENT_NAME = "Разгибание ног в тренажёре";
const OLD_NAME = "Разгибание ног";
const s = stringValue => ({ stringValue });
const b = booleanValue => ({ booleanValue });
const exercise = fields => ({ mapValue: { fields } });
const exercises = values => ({ arrayValue: { values } });
const doc = (collection, id, fields, updateTime = "2026-10-29T09:00:00.123456789Z") => ({
  name: `${ROOT}/${collection}/${id}`, fields, updateTime,
  createTime: "2026-05-05T06:00:00.000000001Z"
});
const currentExercise = (extra = {}) => exercise({
  id: s("new-slot"), name: s(CURRENT_NAME),
  exerciseCardId: s("current-card"), exerciseCardOwnerUid: s("assigned-trainer"),
  video: s("gs://tren-85720.firebasestorage.app/new-video.mp4"), ...extra
});
const oldExercise = (extra = {}) => exercise({
  id: s("old-slot"), name: s(OLD_NAME), video: s("legacy-video.mp4"),
  sets: exercises([exercise({ set: { integerValue: "1" }, reps: { integerValue: "12" },
    weight: s("32,5"), completed: b(true), setType: s("work") }),
  exercise({ set: { integerValue: "2" }, enteredReps: s("10"), enteredWeight: s("35"),
    completed: b(false), arbitrarySavedValue: { nullValue: null } })]),
  ...extra
});

function fixture({ targets = [currentExercise()], historyExercises = [oldExercise()] } = {}) {
  return {
    project: PROJECT, uid: UID,
    profileDocument: { name: ROOT, updateTime: "2026-10-29T08:00:00.999999999Z",
      fields: { assignedProgramUpdatedAt: s(VERSION), role: s("client") } },
    workoutDocuments: [doc("workouts", "current", {
      assignedProgramUpdatedAt: s(VERSION), exercises: exercises(targets)
    }, "2026-10-29T08:30:00.000000007Z")],
    historyDocuments: [doc("history", "may-05", {
      date: { timestampValue: "2026-05-05T06:30:00.123456789Z" },
      assignedProgramUpdatedAt: s("old-version"),
      clientSaveId: s("original-save-id"), workoutId: s("original-workout-id"),
      exercises: exercises(historyExercises),
      plannedSnapshot: { mapValue: { fields: {
        exercises: exercises([oldExercise({ sets: exercises([exercise({ reps: s("8–12"), weight: s("30") })]) })])
      } } },
      extraTimestamp: { timestampValue: "2026-05-05T06:00:00.987654321Z" },
      extraMap: { mapValue: { fields: { unknown: { bytesValue: "AAEC" }, zero: { doubleValue: 0 } } } }
    })],
    aliases: [{ from: OLD_NAME, to: CURRENT_NAME }]
  };
}

function repairedDocument(change) {
  return { ...change.original, fields: { ...change.original.fields, ...change.updates } };
}

function decode(value) {
  if (Object.hasOwn(value, "stringValue")) return value.stringValue;
  if (Object.hasOwn(value, "booleanValue")) return value.booleanValue;
  if (Object.hasOwn(value, "integerValue")) return Number(value.integerValue);
  if (Object.hasOwn(value, "doubleValue")) return value.doubleValue;
  if (Object.hasOwn(value, "timestampValue")) return value.timestampValue;
  if (Object.hasOwn(value, "nullValue")) return null;
  if (value.arrayValue) return (value.arrayValue.values || []).map(decode);
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, child]) => [key, decode(child)]));
  return value;
}

test("персональный план отвергает чужой профиль, workout, history, вложенные пути и неподтверждённые документы", () => {
  const variants = [
    input => { input.uid = "other-owner"; },
    input => { input.project = "other-project"; },
    input => { input.profileDocument.name = `${ROOT}-other`; },
    input => { input.profileDocument.updateTime = ""; },
    input => { input.workoutDocuments[0].name = input.workoutDocuments[0].name.replace(`/users/${UID}/`, "/users/other/"); },
    input => { input.historyDocuments[0].name = input.historyDocuments[0].name.replace(`/users/${UID}/`, "/users/other/"); },
    input => { input.historyDocuments[0].name += "/nested/document"; },
    input => { input.workoutDocuments[0].name = `${ROOT}/workouts/`; },
    input => { input.historyDocuments[0].name = `${ROOT}/history/`; },
    input => { delete input.workoutDocuments[0].updateTime; },
    input => { delete input.historyDocuments[0].updateTime; },
    input => { input.historyDocuments.push(structuredClone(input.historyDocuments[0])); }
  ];
  for (const mutate of variants) {
    const input = fixture();
    mutate(input);
    assert.throws(() => buildPersonalExerciseHistoryRepair(input), /personal-history\//);
  }
});

test("добавляются только два отсутствующих card-поля; timestamps, id, имя, видео, даты, подходы и план сохраняются в wire-виде", () => {
  const input = fixture(), before = structuredClone(input);
  const plan = buildPersonalExerciseHistoryRepair(input);
  assert.deepEqual(input, before);
  assert.equal(plan.changes.length, 1);
  assert.equal(plan.linked.length, 1);
  const change = plan.changes[0], after = repairedDocument(change);
  assert.deepEqual(Object.keys(change.updates), ["exercises"]);
  const fields = after.fields.exercises.arrayValue.values[0].mapValue.fields;
  assert.deepEqual(fields.exerciseCardId, s("current-card"));
  assert.deepEqual(fields.exerciseCardOwnerUid, s("assigned-trainer"));
  const restoredFields = structuredClone(fields);
  delete restoredFields.exerciseCardId;
  delete restoredFields.exerciseCardOwnerUid;
  assert.deepEqual(restoredFields, before.historyDocuments[0].fields.exercises.arrayValue.values[0].mapValue.fields);
  for (const key of ["date", "extraTimestamp", "extraMap", "plannedSnapshot", "clientSaveId", "workoutId"]) {
    assert.deepEqual(after.fields[key], before.historyDocuments[0].fields[key]);
  }
  assert.equal(assertPersonalRepairPreservesResults(change.original, after, change.repairs), true);
  for (const mutate of [
    document => { document.name += "-other"; },
    document => { document.fields.date.timestampValue = "2026-05-06T06:30:00Z"; },
    document => { document.fields.exercises.arrayValue.values[0].mapValue.fields.sets.arrayValue.values[0].mapValue.fields.weight = s("999"); },
    document => { document.fields.exercises.arrayValue.values[0].mapValue.fields.exerciseCardId = s("wrong-card"); }
  ]) {
    const corrupted = structuredClone(after);
    mutate(corrupted);
    assert.throws(() => assertPersonalRepairPreservesResults(change.original, corrupted, change.repairs), /personal-history\//);
  }
  assert.equal(summarizePersonalRepair(plan).actualResultsPreserved, true);
});

test("связи берутся только из текущей версии и требуют уникальную пару card+owner", () => {
  const input = fixture();
  input.workoutDocuments.push(doc("workouts", "archived", {
    assignedProgramUpdatedAt: s("old-version"),
    exercises: exercises([currentExercise({ exerciseCardId: s("archived-card") })])
  }));
  const plan = buildPersonalExerciseHistoryRepair(input);
  assert.equal(plan.linked[0].card, "current-card");
  assert.equal(plan.verify.some(write => write.verify.endsWith("/archived")), false);
  const ambiguous = fixture({ targets: [currentExercise(), currentExercise({ exerciseCardOwnerUid: s("another-trainer") })] });
  assert.throws(() => buildPersonalExerciseHistoryRepair(ambiguous), /alias-target-unavailable/);
  ambiguous.aliases = [];
  ambiguous.includeExactNames = true;
  ambiguous.historyDocuments[0].fields.exercises.arrayValue.values[0].mapValue.fields.name = s(CURRENT_NAME);
  assert.equal(buildPersonalExerciseHistoryRepair(ambiguous).writes.length, 0);
  const noCurrent = fixture();
  noCurrent.workoutDocuments[0].fields.assignedProgramUpdatedAt = s("old-version");
  assert.throws(() => buildPersonalExerciseHistoryRepair(noCurrent), /missing-current-workouts/);
});

test("две новые ссылки либо существующая карточка плюс новая ссылка не схлопывают разные слоты одной тренировки", () => {
  for (const existing of [false, true]) {
    const second = oldExercise({ id: s("second-old-slot"),
      ...(existing ? { exerciseCardId: s("current-card"), exerciseCardOwnerUid: s("assigned-trainer") } : {}) });
    const input = fixture({ historyExercises: [oldExercise(), second] });
    const before = structuredClone(input.historyDocuments);
    const plan = buildPersonalExerciseHistoryRepair(input);
    assert.equal(plan.writes.length, 0);
    assert.equal(plan.linked.length, 0);
    assert.equal(plan.skipped.filter(item => item.reason === "multiple-slots-would-collapse").length, existing ? 1 : 2);
    assert.deepEqual(input.historyDocuments, before);
  }
});

test("разные исходные слоты в разных actual-массивах не получают одну карточку, в том числе при уже существующей ссылке", () => {
  for (const existing of [false, true]) {
    const input = fixture();
    input.historyDocuments[0].fields.actualExercises = exercises([
      oldExercise({ id: s("another-original-slot"),
        ...(existing ? { exerciseCardId: s("current-card"), exerciseCardOwnerUid: s("assigned-trainer") } : {}) })
    ]);
    const before = structuredClone(input.historyDocuments);
    const plan = buildPersonalExerciseHistoryRepair(input);
    assert.equal(plan.changes.length, 0);
    assert.equal(plan.writes.length, 0);
    assert.equal(plan.linked.length, 0);
    assert.equal(plan.skipped.filter(item => item.reason === "cross-array-slots-would-collapse").length, existing ? 1 : 2);
    assert.deepEqual(input.historyDocuments, before);
  }
});

test("частичная, пустая, чужая и конфликтующая карточечная идентичность никогда не переписывается", () => {
  for (const extra of [
    { exerciseCardId: s("current-card") },
    { exerciseCardOwnerUid: s("assigned-trainer") },
    { exerciseCardId: s(""), exerciseCardOwnerUid: s("") },
    { exerciseCardId: { nullValue: null } },
    { exerciseCardId: s("deleted-old-card"), exerciseCardOwnerUid: s("assigned-trainer") },
    { exerciseCardId: s("current-card"), exerciseCardOwnerUid: s("other-trainer") }
  ]) {
    const input = fixture({ historyExercises: [oldExercise(extra)] });
    const plan = buildPersonalExerciseHistoryRepair(input);
    assert.equal(plan.writes.length, 0);
    assert.equal(plan.skipped[0].reason, "existing-or-partial-card-identity");
  }
});

test("точные имена требуют отдельного включения, aliases явные и не используют нечёткое совпадение", () => {
  const exact = fixture({ historyExercises: [oldExercise({ name: s(CURRENT_NAME) })] });
  exact.aliases = [];
  assert.equal(buildPersonalExerciseHistoryRepair(exact).writes.length, 0);
  exact.includeExactNames = true;
  assert.equal(buildPersonalExerciseHistoryRepair(exact).writes.length, 1);
  const explicit = fixture({ historyExercises: [oldExercise({ name: s("  РАЗГИБАНИЕ   НОГ  ") }),
    oldExercise({ id: s("fuzzy"), name: s("Разгибание ног сидя") })] });
  assert.equal(buildPersonalExerciseHistoryRepair(explicit).linked.length, 1);
  const typo = fixture({ historyExercises: [oldExercise({ name: s("Разгибания ног") })] });
  assert.equal(buildPersonalExerciseHistoryRepair(typo).writes.length, 0);
  const duplicateAlias = fixture();
  duplicateAlias.aliases.push({ from: " РАЗГИБАНИЕ  НОГ ", to: CURRENT_NAME });
  assert.throws(() => buildPersonalExerciseHistoryRepair(duplicateAlias), /ambiguous-alias/);
});

test("явные конфликты оборудования и способа нагрузки блокируют связь, совпадающие значения допускаются", () => {
  const conflicts = [
    ["equipment", s("machine"), s("barbell")],
    ["weightMode", s("total"), s("per_hand")],
    ["loadMode", s("stack"), s("external")],
    ["weightMultiplier", { integerValue: "1" }, { integerValue: "2" }],
    ["usesWeight", b(true), b(false)],
    ["requiresWeight", b(true), b(false)]
  ];
  for (const [key, oldValue, targetValue] of conflicts) {
    const input = fixture({ targets: [currentExercise({ [key]: targetValue })],
      historyExercises: [oldExercise({ [key]: oldValue })] });
    const plan = buildPersonalExerciseHistoryRepair(input);
    assert.equal(plan.writes.length, 0);
    assert.equal(plan.skipped[0].reason, "explicit-equipment-or-load-conflict");
    input.workoutDocuments[0].fields.exercises.arrayValue.values[0].mapValue.fields[key] = structuredClone(oldValue);
    assert.equal(buildPersonalExerciseHistoryRepair(input).writes.length, 1);
  }
});

test("копии одной текущей карточки с разными equipment/load constraints неоднозначны, одинаковые копии проверяются все", () => {
  const constraintPairs = [
    ["equipment", s("machine"), s("barbell")],
    ["weightMode", s("total"), s("per_hand")],
    ["loadMode", s("stack"), s("external")],
    ["weightMultiplier", { integerValue: "1" }, { integerValue: "2" }],
    ["usesWeight", b(true), b(false)],
    ["requiresWeight", b(true), b(false)]
  ];
  for (const [field, firstValue, secondValue] of constraintPairs) {
    const input = fixture({ targets: [currentExercise({ [field]: firstValue })] });
    input.workoutDocuments.push(doc("workouts", "second-current-copy", {
      assignedProgramUpdatedAt: s(VERSION), exercises: exercises([
        currentExercise({ id: s("second-current-slot"), [field]: secondValue })
      ])
    }, "2026-10-29T08:45:00.111111111Z"));
    assert.throws(() => buildPersonalExerciseHistoryRepair(input), /alias-target-unavailable/);
    input.aliases = [];
    input.includeExactNames = true;
    input.historyDocuments[0].fields.exercises.arrayValue.values[0].mapValue.fields.name = s(CURRENT_NAME);
    const ambiguous = buildPersonalExerciseHistoryRepair(input);
    assert.equal(ambiguous.writes.length, 0);
    assert.equal(ambiguous.skipped[0].reason, "no-unique-current-card");

    input.workoutDocuments[1].fields.exercises.arrayValue.values[0].mapValue.fields[field] = structuredClone(firstValue);
    const identical = buildPersonalExerciseHistoryRepair(input);
    assert.equal(identical.writes.length, 1);
    assert.deepEqual(identical.verify, [input.profileDocument, ...input.workoutDocuments].map(document => ({
      verify: document.name, currentDocument: { updateTime: document.updateTime }
    })));
  }
});

test("повторный запуск идемпотентен и не создаёт повторных записей", () => {
  const input = fixture(), first = buildPersonalExerciseHistoryRepair(input);
  const second = buildPersonalExerciseHistoryRepair({ ...input,
    historyDocuments: first.changes.map(repairedDocument) });
  assert.equal(second.changes.length, 0);
  assert.equal(second.writes.length, 0);
  assert.equal(second.linked.length, 0);
  assert.equal(second.alreadyLinked.length, 1);
  assert.deepEqual(summarizePersonalRepair(second).mappings, []);
});

test("порядок ключей Firestore map не считается изменением исторического факта", () => {
  const input = fixture(), plan = buildPersonalExerciseHistoryRepair(input), change = plan.changes[0];
  const reverseKeys = value => Array.isArray(value) ? value.map(reverseKeys)
    : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reverseKeys(child)])) : value;
  const reordered = reverseKeys(repairedDocument(change));
  assert.notEqual(JSON.stringify(reordered.fields), JSON.stringify(repairedDocument(change).fields));
  assert.equal(assertPersonalRepairPreservesResults(change.original, reordered, change.repairs), true);
});

test("одна текущая card+owner под разными именами не считается однозначной целью", () => {
  const input = fixture({ targets: [currentExercise(), currentExercise({ id: s("other-current-slot"), name: s("Другое упражнение") })] });
  assert.throws(() => buildPersonalExerciseHistoryRepair(input), /alias-target-unavailable/);
  input.aliases = [];
  input.includeExactNames = true;
  input.historyDocuments[0].fields.exercises.arrayValue.values[0].mapValue.fields.name = s(CURRENT_NAME);
  const plan = buildPersonalExerciseHistoryRepair(input);
  assert.equal(plan.writes.length, 0);
  assert.equal(plan.linked.length, 0);
  assert.equal(plan.skipped[0].reason, "no-unique-current-card");
});

test("preconditions привязаны к точным profile/workout/history updateTime, updateMask не затрагивает другие поля", () => {
  const input = fixture(), plan = buildPersonalExerciseHistoryRepair(input);
  assert.equal(plan.ownerPath, ROOT);
  assert.deepEqual(plan.verify, [input.profileDocument, input.workoutDocuments[0]].map(document => ({
    verify: document.name, currentDocument: { updateTime: document.updateTime }
  })));
  assert.deepEqual(plan.writes[0], {
    update: { name: input.historyDocuments[0].name, fields: plan.changes[0].updates },
    updateMask: { fieldPaths: ["exercises"] },
    currentDocument: { updateTime: input.historyDocuments[0].updateTime }
  });
  assert.equal([...plan.verify.map(item => item.verify), ...plan.writes.map(item => item.update.name)]
    .every(path => path === ROOT || path.startsWith(`${ROOT}/`)), true);
  assert.equal(plan.writes.some(write => write.update.name.includes("/trainerExerciseCards/")), false);
});

async function selectHistoryWithoutNetwork() {
  const sdk = `const forbidden=()=>{throw new Error('Сеть запрещена в синтетическом тесте')};
    export const collection=forbidden,documentId=forbidden,getDocs=forbidden,limit=forbidden,
      orderBy=forbidden,query=forbidden,startAfter=forbidden;`;
  let source = await readFile(new URL("../src/utils/workoutExerciseHistory.js", import.meta.url), "utf8");
  source = source.replace('from "firebase/firestore"', `from ${JSON.stringify(`data:text/javascript,${encodeURIComponent(sdk)}`)}`);
  for (const name of ["authSession", "sessionResource", "workoutHistoryRevision", "workoutMediaMerge"]) {
    source = source.replace(`from "./${name}.js"`, `from ${JSON.stringify(new URL(`../src/utils/${name}.js`, import.meta.url).href)}`);
  }
  return (await import(`data:text/javascript,${encodeURIComponent(source)}`)).selectRecentWorkoutExerciseHistory;
}

test("синтетическая интеграция: новая ссылка возвращает майскую запись в клиентский и тренерский прогресс без изменения факта", async () => {
  const selectRecentWorkoutExerciseHistory = await selectHistoryWithoutNetwork();
  const input = fixture(), original = input.historyDocuments[0];
  const target = decode(currentExercise());
  const before = { id: "may-05", ...decode({ mapValue: { fields: original.fields } }) };
  assert.equal(selectRecentWorkoutExerciseHistory([before], target).entries.length, 0);
  assert.equal(getExerciseActualProgress([before], target).sessionCount, 0);
  const plan = buildPersonalExerciseHistoryRepair(input);
  const after = { id: "may-05", ...decode({ mapValue: { fields: repairedDocument(plan.changes[0]).fields } }) };
  const selected = selectRecentWorkoutExerciseHistory([after], target);
  const progress = getExerciseActualProgress([after], target);
  assert.equal(selected.entries.length, 1);
  assert.equal(selected.entries[0].id, "may-05");
  assert.equal(selected.entries[0].sets.length, 1);
  assert.equal(selected.entries[0].sets[0].weight, 32.5);
  assert.equal(selected.entries[0].sets[0].reps, 12);
  assert.equal(progress.sessionCount, 1);
  assert.equal(progress.lastSession.bestWeight, 32.5);
  assert.equal(progress.lastSession.totalReps, 12);
  assert.deepEqual(after.exercises[0].sets, before.exercises[0].sets);
  assert.equal(after.exercises[0].id, "old-slot");
  assert.equal(after.exercises[0].name, OLD_NAME);
  assert.equal(after.exercises[0].video, "legacy-video.mp4");
  assert.equal(after.date, before.date);
});

test("зеркало одного исходного ID в двух actual-массивах допустимо и остаётся одной сессией обоих прогрессов", async () => {
  const selectRecentWorkoutExerciseHistory = await selectHistoryWithoutNetwork();
  const input = fixture();
  input.historyDocuments[0].fields.actualExercises = structuredClone(input.historyDocuments[0].fields.exercises);
  const before = structuredClone(input.historyDocuments[0]);
  const plan = buildPersonalExerciseHistoryRepair(input);
  assert.equal(plan.changes.length, 1);
  assert.equal(plan.linked.length, 2);
  assert.equal(plan.skipped.length, 0);
  assert.deepEqual(plan.writes[0].updateMask.fieldPaths, ["exercises", "actualExercises"]);
  const after = repairedDocument(plan.changes[0]);
  for (const field of ["exercises", "actualExercises"]) {
    const fields = after.fields[field].arrayValue.values[0].mapValue.fields;
    assert.deepEqual(fields.id, s("old-slot"));
    assert.deepEqual(fields.exerciseCardId, s("current-card"));
    assert.deepEqual(fields.exerciseCardOwnerUid, s("assigned-trainer"));
    assert.deepEqual(fields.sets, before.fields[field].arrayValue.values[0].mapValue.fields.sets);
  }
  assert.equal(assertPersonalRepairPreservesResults(before, after, plan.changes[0].repairs), true);
  const target = decode(currentExercise());
  const history = [{ id: "may-05", ...decode({ mapValue: { fields: after.fields } }) }];
  assert.equal(selectRecentWorkoutExerciseHistory(history, target).entries.length, 1);
  const progress = getExerciseActualProgress(history, target);
  assert.equal(progress.sessionCount, 1);
  assert.equal(progress.lastSession.bestWeight, 32.5);
  assert.equal(progress.lastSession.totalReps, 12);
  assert.equal(buildPersonalExerciseHistoryRepair({ ...input, historyDocuments: [after] }).writes.length, 0);
});
