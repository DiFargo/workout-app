import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildNextTrainerClientSetupChecklist, getTrainerClientSetupChecklist } from "../src/utils/trainerClientSetupChecklist.js";

const workspaceSource = await readFile(new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url), "utf8");
const start = workspaceSource.indexOf("  async function completeSetupStep(");
const end = workspaceSource.indexOf("  async function saveSetupWorkoutSchedule(", start);
assert.ok(start >= 0 && end > start, "The live setup handlers must be available for the focused test");
const createHandlers = new Function("onSaveClientSetupProgress", "onAssignProgram", "initialChecklist", "wizardOpen", `
  const client = { id: "client" };
  let setupChecklist = initialChecklist;
  let setupProgressStatus = "";
  let setupProgressSaving = false;
  let setupWizardOpen = wizardOpen;
  const setSetupChecklist = value => { setupChecklist = value; };
  const setSetupProgressStatus = value => { setupProgressStatus = value; };
  const setSetupProgressSaving = value => { setupProgressSaving = value; };
  const setSetupWizardOpen = value => { setupWizardOpen = value; };
  ${workspaceSource.slice(start, end)}
  return { completeSetupStep, assignProgram, state: () => ({ setupChecklist, setupProgressStatus, setupProgressSaving, setupWizardOpen }) };
`);

function checklistAt(step) {
  let checklist = getTrainerClientSetupChecklist();
  for (const earlier of ["program", "schedule", "nutrition", "notifications"]) {
    if (earlier === step) break;
    checklist = buildNextTrainerClientSetupChecklist(checklist, earlier);
  }
  return checklist;
}

test("setup keeps the same step mounted until its progress write is acknowledged", async () => {
  for (const step of ["schedule", "nutrition", "notifications"]) {
    const initial = checklistAt(step);
    const confirmed = buildNextTrainerClientSetupChecklist(initial, step);
    let acknowledge;
    const handlers = createHandlers(() => new Promise(resolve => { acknowledge = resolve; }), () => true, initial, true);
    const pending = handlers.completeSetupStep(step);
    assert.equal(handlers.state().setupChecklist, initial);
    assert.equal(handlers.state().setupWizardOpen, true);
    assert.equal(handlers.state().setupProgressSaving, true);
    acknowledge(confirmed);
    assert.equal(await pending, confirmed);
    assert.equal(handlers.state().setupChecklist, confirmed);
    assert.equal(handlers.state().setupWizardOpen, step !== "notifications");
    assert.equal(handlers.state().setupProgressSaving, false);
  }
});

test("failed progress writes explain the saved setting and retain the current form", async () => {
  for (const [step, savedSetting] of [["schedule", "Расписание уже сохранено"], ["nutrition", "План питания уже сохранён"], ["notifications", "Настройки напоминаний уже сохранены"]]) {
    for (const fail of [() => false, () => { throw new Error("network failed"); }]) {
      const initial = checklistAt(step);
      const handlers = createHandlers(fail, () => true, initial, true);
      await assert.rejects(handlers.completeSetupStep(step), error => {
        assert.ok(error.assignmentMessage.startsWith(savedSetting));
        assert.match(error.assignmentMessage, /Не удалось сохранить отметку завершения шага/);
        assert.match(error.assignmentMessage, /Правки остались в форме/);
        return true;
      });
      assert.equal(handlers.state().setupChecklist, initial);
      assert.equal(handlers.state().setupWizardOpen, true);
      assert.equal(handlers.state().setupProgressSaving, false);
    }
  }
});

test("retry after a committed assignment saves only its progress mark", async () => {
  const initial = checklistAt("program");
  let assignments = 0;
  let progressWrites = 0;
  const handlers = createHandlers(() => ++progressWrites === 1 ? false : buildNextTrainerClientSetupChecklist(initial, "program"), () => {
    assignments++;
    return { assignedProgramAddedAt: "committed-assignment" };
  }, initial, true);
  await assert.rejects(handlers.assignProgram({}), error => {
    assert.match(error.assignmentMessage, /Программа уже назначена/);
    return true;
  });
  assert.equal(handlers.state().setupChecklist, initial);
  assert.equal(handlers.state().setupWizardOpen, true);
  assert.equal(assignments, 1);
  const retried = await handlers.assignProgram({});
  assert.equal(retried.setupProgressSaved, true);
  assert.equal(progressWrites, 2);
  assert.equal(assignments, 1);
  assert.equal(handlers.state().setupChecklist.currentStep, "schedule");
  assert.equal(handlers.state().setupProgressStatus, "");
});

test("assignment outside the wizard remains committed when the separate mark fails", async () => {
  const initial = checklistAt("program");
  const assignment = { assignedProgramAddedAt: "committed-assignment" };
  let assignments = 0;
  const handlers = createHandlers(() => false, () => { assignments++; return assignment; }, initial, false);
  const result = await handlers.assignProgram({});
  assert.equal(result.assignment, assignment);
  assert.equal(result.setupProgressSaved, false);
  assert.match(handlers.state().setupProgressStatus, /назначать программу заново не нужно/);
  await handlers.assignProgram({});
  assert.equal(assignments, 1);
  assert.equal(handlers.state().setupWizardOpen, false);
});
