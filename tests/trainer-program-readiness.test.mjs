import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  getTrainerProgramStatusMeta,
  TRAINER_PROGRAM_STATUSES
} from "../src/utils/trainerProgramLifecycle.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("draft program remains private until it is explicitly prepared", () => {
  assert.equal(
    getTrainerProgramStatusMeta({ lifecycleStatus: TRAINER_PROGRAM_STATUSES.DRAFT }).id,
    TRAINER_PROGRAM_STATUSES.DRAFT
  );
  assert.equal(
    getTrainerProgramStatusMeta({ lifecycleStatus: TRAINER_PROGRAM_STATUSES.READY }).id,
    TRAINER_PROGRAM_STATUSES.READY
  );
  assert.equal(getTrainerProgramStatusMeta({}).id, TRAINER_PROGRAM_STATUSES.READY);
});

test("assignment flow blocks drafts and exposes an explicit prepare action", () => {
  const handlers = source("src/features/trainer/trainerProgramTemplateHandlers.js");
  const overview = source("src/features/trainer/TrainerProgramOverviewPage.jsx");
  const workspace = source("src/components/trainer/TrainerWorkspace.jsx");

  assert.match(handlers, /workout-assignment-draft/);
  assert.match(handlers, /Сначала подготовьте программу к назначению/);
  assert.match(overview, /Подготовить к назначению/);
  assert.match(workspace, /TRAINER_PROGRAM_STATUSES\.DRAFT/);
});

test("program library aligns with the workspace and fills the available desktop row", () => {
  const styles = source("src/features/trainer/TrainerProgramOverviewPage.module.css");

  assert.match(styles, /\.root \{[\s\S]*?padding: var\(--trainer-page-block, 28px\) 0 44px;/);
  assert.match(styles, /\.grid \{[\s\S]*?grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, 260px\), 1fr\)\);[\s\S]*?align-items: stretch;/);
  assert.match(styles, /\.card,\n\.createCard \{[\s\S]*?min-height: 320px;/);
  assert.match(styles, /\.cardStats \{[\s\S]*?margin-top: auto;[\s\S]*?padding-top: 20px;/);
});
