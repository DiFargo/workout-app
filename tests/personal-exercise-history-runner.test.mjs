import assert from "node:assert/strict";
import test from "node:test";
import { decodeFirestoreFields } from "../scripts/inspect-personal-exercise-history.mjs";
import { parsePersonalRepairArgs, runPersonalExerciseRepair } from "../scripts/repair-personal-exercise-history.mjs";

const EMAIL = "personal-repair@example.test";
const ROOT = "projects/tren-85720/databases/(default)/documents/users/runner-owner";
const VERSION = "current-version";
const OLD_NAME = "Разгибание ног";
const CURRENT_NAME = "Разгибание ног в тренажёре";
const s = stringValue => ({ stringValue });
const map = fields => ({ mapValue: { fields } });
const array = values => ({ arrayValue: { values } });
const timestamp = "2026-10-29T10:00:00.000000001Z";
const document = (path, fields) => ({ name: `${ROOT}${path}`, fields, updateTime: timestamp });

function inspection() {
  const profile = { email: EMAIL, role: "client", assignedProgramUpdatedAt: VERSION };
  const entry = name => map({ id: s(name === OLD_NAME ? "old-slot" : "unrelated-slot"), name: s(name),
    video: s("old-video.mp4"), sets: array([map({ reps: { integerValue: "12" }, weight: s("32,5"), completed: { booleanValue: true } })]) });
  return {
    uid: "runner-owner", profile,
    document: document("", Object.fromEntries(Object.entries(profile).map(([key, value]) => [key, s(value)]))),
    workouts: [document("/workouts/current", { assignedProgramUpdatedAt: s(VERSION), exercises: array([map({
      id: s("new-slot"), name: s(CURRENT_NAME), video: s("new-video.mp4"),
      exerciseCardId: s("canonical-card"), exerciseCardOwnerUid: s("trainer-owner")
    })]) })],
    history: [document("/history/may-05", { date: { timestampValue: "2026-05-05T08:00:00.123456789Z" },
      assignedProgramUpdatedAt: s("old-version"), exercises: array([entry(OLD_NAME)]),
      plannedSnapshot: map({ exercises: array([entry(OLD_NAME)]) }), arbitraryOriginal: s("preserve-me") }),
    document("/history/unrelated", { date: { timestampValue: "2026-05-06T08:00:00.000000001Z" },
      exercises: array([entry("Жим лёжа")]), arbitraryOriginal: s("unrelated-preserve-me") })]
  };
}

function options(extra = {}) {
  return { email: EMAIL, aliases: [{ from: OLD_NAME, to: CURRENT_NAME }], includeExactNames: false,
    apply: false, ...extra };
}

function harness({ onCommit, onInspect } = {}) {
  let state = inspection(), inspections = 0;
  const commits = [], requestedEmails = [];
  return {
    commits, requestedEmails,
    get state() { return structuredClone(state); },
    get inspections() { return inspections; },
    dependencies: {
      async inspect(email) {
        requestedEmails.push(email);
        inspections += 1;
        if (onInspect) onInspect(state, inspections);
        return structuredClone(state);
      },
      async commit(plan) {
        commits.push(structuredClone(plan));
        assert.equal(plan.ownerPath, ROOT);
        for (const write of plan.writes) {
          assert.ok(write.update.name.startsWith(`${ROOT}/history/`));
          const original = state.history.find(item => item.name === write.update.name);
          assert.equal(write.currentDocument.updateTime, original.updateTime);
        }
        if (onCommit) await onCommit(state, plan);
        else {
          state = { ...state, history: state.history.map(original => {
            const write = plan.writes.find(item => item.update.name === original.name);
            return write ? { ...original, fields: { ...original.fields, ...structuredClone(write.update.fields) },
              updateTime: "2026-10-29T10:01:00.000000002Z" } : original;
          }) };
        }
      }
    }
  };
}

const applyOptions = extra => options({ apply: true, confirmedEmail: EMAIL, expectedDocuments: 1, expectedLinks: 1, ...extra });

test("dry-run строит и проверяет план, но commit не вызывается и исходные документы не меняются", async () => {
  const io = harness(), before = io.state;
  const report = await runPersonalExerciseRepair(options(), io.dependencies);
  assert.equal(io.inspections, 1);
  assert.deepEqual(io.commits, []);
  assert.deepEqual(io.state, before);
  assert.equal(report.mode, "План без записи");
  assert.equal(report.changedHistoryDocuments, 1);
  assert.equal(report.addedExerciseLinks, 1);
  assert.equal(report.writesApplied, 0);
  assert.equal(report.actualResultsPreserved, true);
  assert.equal(report.globalLibraryChanged, false);
  assert.equal(report.applicationRuntimeChanged, false);
  assert.deepEqual(report.progress.map(item => [item.clientBefore, item.clientAfter, item.trainerBefore, item.trainerAfter]), [[0, 1, 0, 1]]);
});

test("CLI apply требует подтверждения того же email и обоих точных счётчиков", () => {
  const valid = [`--email=${EMAIL}`, "--apply", `--confirm-email=${EMAIL}`, "--expected-documents=1", "--expected-links=1"];
  const parsed = parsePersonalRepairArgs(valid);
  assert.equal(parsed.apply, true);
  assert.equal(parsed.confirmedEmail, EMAIL);
  assert.equal(parsed.expectedDocuments, 1);
  assert.equal(parsed.expectedLinks, 1);
  for (const flags of [
    valid.filter(flag => !flag.startsWith("--confirm-email=")),
    valid.map(flag => flag.startsWith("--confirm-email=") ? "--confirm-email=someone-else@example.test" : flag),
    valid.filter(flag => !flag.startsWith("--expected-documents=")),
    valid.filter(flag => !flag.startsWith("--expected-links=")),
    valid.map(flag => flag === "--expected-links=1" ? "--expected-links=1.5" : flag),
    [...valid, "--apply"], [...valid, "--project=other"], [...valid, "--token=not-allowed"]
  ]) assert.throws(() => parsePersonalRepairArgs(flags), /personal-history\//);
});

test("программный apply без подтверждения email или целых counts отклоняется ещё до inspect", async () => {
  for (const override of [
    { confirmedEmail: "" }, { confirmedEmail: "someone-else@example.test" },
    { expectedDocuments: undefined }, { expectedLinks: undefined },
    { expectedDocuments: 1.1 }, { expectedLinks: "1" }
  ]) {
    const io = harness();
    await assert.rejects(runPersonalExerciseRepair(applyOptions(override), io.dependencies), /apply-confirmation-required/);
    assert.equal(io.inspections, 0);
    assert.equal(io.commits.length, 0);
  }
});

test("несовпадение любого ожидаемого count останавливает apply до commit", async () => {
  for (const override of [{ expectedDocuments: 0 }, { expectedDocuments: 2 }, { expectedLinks: 0 }, { expectedLinks: 2 }]) {
    const io = harness(), before = io.state;
    await assert.rejects(runPersonalExerciseRepair(applyOptions(override), io.dependencies), /plan-counts-changed/);
    assert.equal(io.inspections, 1);
    assert.equal(io.commits.length, 0);
    assert.deepEqual(io.state, before);
  }
});

test("отклонённый или неизвестный commit не повторяется и не выдаётся за успех", async () => {
  for (const message of ["personal-history/precondition-or-commit-rejected", "personal-history/commit-unavailable", "network outcome unknown"]) {
    const error = new Error(message), io = harness({ onCommit: async () => { throw error; } });
    await assert.rejects(runPersonalExerciseRepair(applyOptions(), io.dependencies), candidate => candidate === error);
    assert.equal(io.inspections, 1);
    assert.equal(io.commits.length, 1);
  }
});

test("post-verify обнаруживает изменение фактического веса, даты и посторонней истории после commit", async () => {
  for (const mutate of [
    state => { state.history[0].fields.exercises.arrayValue.values[0].mapValue.fields.sets.arrayValue.values[0].mapValue.fields.weight = s("999"); },
    state => { state.history[0].fields.date = { timestampValue: "2026-05-07T00:00:00.000Z" }; },
    state => { state.history[1].fields.arbitraryOriginal = s("changed-unrelated-history"); }
  ]) {
    const io = harness({ onInspect: (state, count) => { if (count === 2) mutate(state); } });
    await assert.rejects(runPersonalExerciseRepair(applyOptions(), io.dependencies), /historical-result-changed|unrelated-history-changed/);
    assert.equal(io.inspections, 2);
    assert.equal(io.commits.length, 1);
  }
});

test("post-verify отклоняет смену владельца, потерю документа и отсутствие добавленной связи", async () => {
  for (const mutate of [
    state => { state.uid = "other-owner"; },
    state => { state.history.pop(); },
    state => { delete state.history[0].fields.exercises.arrayValue.values[0].mapValue.fields.exerciseCardId; }
  ]) {
    const io = harness({ onInspect: (state, count) => { if (count === 2) mutate(state); } });
    await assert.rejects(runPersonalExerciseRepair(applyOptions(), io.dependencies), /owner-changed|history-count-changed|wrong-added-card/);
    assert.equal(io.commits.length, 1);
  }
});

test("post-commit смена profile/workout revision либо набора workouts останавливает верификацию без повторной записи", async () => {
  for (const mutate of [
    state => { state.document.updateTime = "2026-10-29T10:02:00.000000003Z"; },
    state => { state.document.name += "-other-profile"; },
    state => { state.workouts[0].updateTime = "2026-10-29T10:02:00.000000003Z"; },
    state => { state.workouts[0].name = `${ROOT}/workouts/replacement-current`; },
    state => { state.workouts.push(document("/workouts/added-concurrently", { assignedProgramUpdatedAt: s(VERSION) })); },
    state => { state.workouts.pop(); }
  ]) {
    const io = harness({ onInspect: (state, count) => { if (count === 2) mutate(state); } });
    await assert.rejects(runPersonalExerciseRepair(applyOptions(), io.dependencies), /personal-history\/verification-target-changed/);
    assert.equal(io.inspections, 2);
    assert.equal(io.commits.length, 1);
    assert.deepEqual(io.state.history[0].fields.exercises.arrayValue.values[0].mapValue.fields.exerciseCardId, s("canonical-card"));
  }
});

test("успешная metadata-only операция проходит post-verify и повторный apply с нулевыми counts не пишет", async () => {
  const io = harness(), before = io.state;
  const report = await runPersonalExerciseRepair(applyOptions(), io.dependencies);
  assert.equal(report.verified, true);
  assert.equal(report.writesApplied, 1);
  assert.equal(report.repeatedWrites, 0);
  assert.equal(report.privateDocumentsPersisted, false);
  assert.equal(report.authenticationChanged, false);
  assert.equal(io.inspections, 2);
  assert.equal(io.commits.length, 1);
  const after = io.state;
  assert.deepEqual(after.history[1], before.history[1]);
  const restored = structuredClone(after.history[0].fields);
  delete restored.exercises.arrayValue.values[0].mapValue.fields.exerciseCardId;
  delete restored.exercises.arrayValue.values[0].mapValue.fields.exerciseCardOwnerUid;
  assert.deepEqual(restored, before.history[0].fields);
  assert.deepEqual(decodeFirestoreFields(after.history[0].fields).exercises[0].sets,
    decodeFirestoreFields(before.history[0].fields).exercises[0].sets);
  assert.deepEqual(io.commits[0].verify.map(write => write.verify), [ROOT, `${ROOT}/workouts/current`]);
  const repeated = await runPersonalExerciseRepair(applyOptions({ expectedDocuments: 0, expectedLinks: 0 }), io.dependencies);
  assert.equal(repeated.verified, true);
  assert.equal(repeated.changedHistoryDocuments, 0);
  assert.equal(repeated.writesApplied, 0);
  assert.equal(repeated.alreadyLinked, 1);
  assert.equal(io.commits.length, 1);
  assert.equal(io.requestedEmails.every(email => email === EMAIL), true);
});
