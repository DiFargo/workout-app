import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

import {
  buildNextTrainerClientSetupChecklist,
  getTrainerClientSetupChecklist
} from "../src/utils/trainerClientSetupChecklist.js";

const workspace = readFileSync(new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url), "utf8");
const savedAt = "2026-10-17T12:00:00.000Z";

function extractHandler(name) {
  const start = workspace.indexOf(`  async function ${name}(`);
  const end = workspace.indexOf("\n  }", start);
  assert.ok(start >= 0 && end > start, `real ${name} handler is present`);
  return workspace.slice(start, end + "\n  }".length).trim();
}

function fixture({ checklistSave = "success", assignmentResult, assignmentError, missingChecklistSave = false, wizardOpen = true } = {}) {
  const assignment = assignmentResult === undefined
    ? { assignmentKey: `time:${savedAt}`, assignedAt: savedAt, programId: "fixture-program" }
    : assignmentResult;
  const initialChecklist = getTrainerClientSetupChecklist({});
  const state = { checklist: initialChecklist, wizardOpen, status: "", saving: false };
  const calls = { assignment: [], checklist: [], saving: [] };
  const client = { id: "fixture-client" };
  let saveBehavior = checklistSave;
  let context;
  context = vm.createContext({
    client,
    setupChecklist: initialChecklist,
    setupProgressStatus: state.status,
    setupWizardOpen: state.wizardOpen,
    setupProgressSaving: false,
    buildNextTrainerClientSetupChecklist: (current, step) => buildNextTrainerClientSetupChecklist(current, step, savedAt),
    setSetupChecklist(value) {
      state.checklist = typeof value === "function" ? value(state.checklist) : value;
    },
    setSetupWizardOpen(value) { state.wizardOpen = value; },
    setSetupProgressStatus(value) { state.status = value; },
    setSetupProgressSaving(value) {
      state.saving = value;
      context.setupProgressSaving = value;
      calls.saving.push(value);
    },
    onAssignProgram: async (options) => {
      calls.assignment.push(options);
      if (assignmentError) throw assignmentError;
      return assignment;
    },
    onSaveClientSetupProgress: missingChecklistSave ? undefined : async (step, savedClient, current) => {
      calls.checklist.push({ step, client: savedClient, current });
      if (saveBehavior === "throw") throw new Error("fixture-checklist-save-failed");
      if (saveBehavior === "false") return false;
      return buildNextTrainerClientSetupChecklist(current, step, savedAt);
    }
  });
  const completeSetupStep = vm.runInContext(`(${extractHandler("completeSetupStep")})`, context);
  context.completeSetupStep = completeSetupStep;
  const assignProgram = vm.runInContext(`(${extractHandler("assignProgram")})`, context);
  function invokeOnNextRender(handler, args) {
    // React state changes affect the following render, not the current handler's closure.
    context.setupChecklist = state.checklist;
    context.setupProgressStatus = state.status;
    context.setupWizardOpen = state.wizardOpen;
    return handler(...args);
  }
  return {
    assignment, initialChecklist, client, state, calls,
    completeSetupStep: (...args) => invokeOnNextRender(completeSetupStep, args),
    assignProgram: (...args) => invokeOnNextRender(assignProgram, args),
    setChecklistSave(value) { saveBehavior = value; }
  };
}

for (const checklistSave of ["false", "throw"]) {
  test(`committed assignment outside the wizard remains successful when checklist save returns ${checklistSave}`, async () => {
    const f = fixture({ checklistSave, wizardOpen: false });
    const options = { programName: "Fixture program", throwOnError: true, skipConfirmation: true };
    const result = await f.assignProgram(options);

    assert.equal(f.calls.assignment.length, 1);
    assert.equal(f.calls.assignment[0], options);
    assert.equal(result.assignmentKey, f.assignment.assignmentKey);
    assert.equal(result.programId, f.assignment.programId);
    assert.equal(result.assignedAt, savedAt);
    assert.equal(result.assignment, f.assignment);
    assert.equal(result.checklist, false);
    assert.equal(result.setupProgressSaved, false);
    assert.equal(f.state.checklist, f.initialChecklist);
    assert.equal(f.state.checklist.completedSteps.program, false);
    assert.equal(f.state.checklist.currentStep, "program");
    assert.equal(f.state.wizardOpen, false);
    assert.ok(f.state.status, "secondary save failure is visible instead of a false assignment failure");
    assert.equal(f.state.saving, false);
  });

  test(`committed wizard assignment retains its step when checklist save returns ${checklistSave}`, async () => {
    const f = fixture({ checklistSave });
    await assert.rejects(f.assignProgram({ skipConfirmation: true }), error => {
      assert.match(error.assignmentMessage, /Программа уже назначена/);
      assert.match(error.assignmentMessage, /назначать программу заново не нужно/);
      return true;
    });
    assert.equal(f.calls.assignment.length, 1);
    assert.equal(f.calls.checklist.length, 1);
    assert.equal(f.state.checklist, f.initialChecklist);
    assert.equal(f.state.wizardOpen, true);
    assert.ok(f.state.status);
    assert.equal(f.state.saving, false);
  });
}

test("missing checklist persistence cannot undo a committed assignment", async () => {
  const f = fixture({ missingChecklistSave: true, wizardOpen: false });
  const result = await f.assignProgram({ skipConfirmation: true });
  assert.equal(result.assignmentKey, f.assignment.assignmentKey);
  assert.equal(result.setupProgressSaved, false);
  assert.equal(f.state.checklist, f.initialChecklist);
  assert.equal(f.state.checklist.completedSteps.program, false);
  assert.ok(f.state.status);
  assert.equal(f.state.saving, false);
});

test("checklist-only retry clears the warning without assigning the program again", async () => {
  const f = fixture({ checklistSave: "false" });
  await assert.rejects(f.assignProgram({ skipConfirmation: true }), error => /Программа уже назначена/.test(error.assignmentMessage));
  const retainedChecklist = f.state.checklist;
  assert.ok(f.state.status);

  f.setChecklistSave("success");
  const result = await f.assignProgram({ skipConfirmation: true });
  const retried = result.checklist;

  assert.equal(f.calls.assignment.length, 1, "retry performs no second assignment/commit");
  assert.equal(f.calls.checklist.length, 2);
  assert.equal(f.calls.checklist[1].step, "program");
  assert.equal(f.calls.checklist[1].client, f.client);
  assert.equal(f.calls.checklist[1].current, retainedChecklist);
  assert.equal(result.setupProgressSaved, true);
  assert.equal(retried.completedSteps.program, true);
  assert.equal(retried.currentStep, "schedule");
  assert.equal(f.state.checklist, retried);
  assert.equal(f.state.status, "");
  assert.equal(f.state.saving, false);
});

for (const checklistSave of ["false", "throw"]) {
  test(`an ordinary uncommitted setup step retains the form after ${checklistSave}`, async () => {
    const f = fixture({ checklistSave });
    await assert.rejects(f.completeSetupStep("program"), error => {
      assert.match(error.assignmentMessage, /Не удалось сохранить отметку завершения шага/);
      assert.match(error.assignmentMessage, /Правки остались в форме/);
      return true;
    });
    assert.equal(f.state.checklist, f.initialChecklist);
    assert.equal(f.state.checklist.completedSteps.program, false);
    assert.equal(f.state.checklist.currentStep, "program");
    assert.equal(f.state.wizardOpen, true);
    assert.equal(f.state.saving, false);
    assert.equal(f.calls.assignment.length, 0);
  });
}

test("a failed assignment returns false without saving any checklist step", async () => {
  const f = fixture({ assignmentResult: false });
  assert.equal(await f.assignProgram({ throwOnError: true }), false);
  assert.equal(f.calls.assignment.length, 1);
  assert.equal(f.calls.checklist.length, 0);
  assert.equal(f.state.checklist, f.initialChecklist);
  assert.equal(f.state.status, "");
});

test("a true assignment error is propagated unchanged and does not complete setup", async () => {
  const error = Object.assign(new Error("fixture-assignment-rejected"), { assignmentMessage: "Fixture rejection" });
  const f = fixture({ assignmentError: error });
  await assert.rejects(f.assignProgram({ throwOnError: true }), (actual) => actual === error);
  assert.equal(f.calls.assignment.length, 1);
  assert.equal(f.calls.checklist.length, 0);
  assert.equal(f.state.checklist, f.initialChecklist);
  assert.equal(f.state.status, "");
});

test("successful assignment retains its identity and marks setup progress persisted", async () => {
  const f = fixture();
  const result = await f.assignProgram({ skipConfirmation: true });
  assert.equal(result.assignmentKey, f.assignment.assignmentKey);
  assert.equal(result.programId, f.assignment.programId);
  assert.equal(result.assignment, f.assignment);
  assert.equal(result.setupProgressSaved, true);
  assert.equal(result.checklist, f.state.checklist);
  assert.equal(result.checklist.completedSteps.program, true);
  assert.equal(f.calls.checklist.length, 1);
  assert.equal(f.state.status, "");
  assert.equal(f.state.saving, false);
});
