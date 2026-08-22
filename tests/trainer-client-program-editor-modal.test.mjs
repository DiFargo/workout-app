import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workspacePath = new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url);
const stylesPath = new URL("../src/components/trainer/TrainerClientWorkoutPlan.module.css", import.meta.url);

test("client program editor uses its responsive modal layout", async () => {
  const [workspace, styles] = await Promise.all([
    readFile(workspacePath, "utf8"),
    readFile(stylesPath, "utf8"),
  ]);

  assert.match(workspace, /trainerClientProgramEditorModal/);
  assert.match(styles, /:global\(\.trainerWorkoutEditorModal\.trainerClientProgramEditorModal\)/);
  assert.match(styles, /width: min\(96vw, 1900px\) !important/);
  assert.match(styles, /max-width: min\(96vw, 1900px\) !important/);
  assert.match(styles, /height: min\(920px, calc\(100dvh - 32px\)\) !important/);
  assert.match(styles, /grid-template-columns: 238px minmax\(0, 1fr\)/);
});

test("client program editor uses all client history for exercise progress without unlocking prior workouts", async () => {
  const workspace = await readFile(workspacePath, "utf8");

  assert.match(workspace, /history=\{scheduleHistory\}[\s\S]{0,120}progressHistory=\{history\}/);
  assert.match(workspace, /progressHistory = history/);
  assert.match(workspace, /getExerciseActualProgress\(progressHistory, exercise\)/);
});

test("trainer program lifecycle shows archive and restore without surfacing delete", async () => {
  const workspace = await readFile(workspacePath, "utf8");

  assert.match(workspace, /clientProfile: client/);
  assert.match(workspace, /const primaryProgramAssignment = currentProgramAssignment \|\| nextProgramAssignment \|\| null;/);
  assert.match(workspace, /const showArchiveRestore = assignment\.status === "archived" && isTrainerAssigned;/);
  assert.match(workspace, /<Archive size=\{15\} \/>Достать из архива/);
  assert.doesNotMatch(workspace, /requestProgramAssignmentAction\(assignment, "delete"\)/);
});
