import test from "node:test";
import assert from "node:assert/strict";

import {
  TRAINER_PROGRAM_STATUSES,
  buildClientProgramLifecycleMetadata,
  buildDraftProgramMetadata,
  buildProgramAssignmentMetadata,
  getTrainerProgramStatusMeta,
  isTrainerProgramArchived,
  isTrainerProgramClientVisible,
  normalizeTrainerProgramStatus
} from "../src/utils/trainerProgramLifecycle.js";

test("trainer program lifecycle normalizes known states", () => {
  assert.equal(normalizeTrainerProgramStatus("draft"), TRAINER_PROGRAM_STATUSES.DRAFT);
  assert.equal(normalizeTrainerProgramStatus("assigned"), TRAINER_PROGRAM_STATUSES.ASSIGNED);
  assert.equal(normalizeTrainerProgramStatus("active"), TRAINER_PROGRAM_STATUSES.ACTIVE);
  assert.equal(normalizeTrainerProgramStatus("completed"), TRAINER_PROGRAM_STATUSES.COMPLETED);
  assert.equal(normalizeTrainerProgramStatus("archive"), TRAINER_PROGRAM_STATUSES.DRAFT);
});

test("trainer program lifecycle exposes readable status metadata", () => {
  assert.deepEqual(getTrainerProgramStatusMeta({ lifecycleStatus: "draft" }), {
    id: "draft",
    label: "Черновик",
    tone: "draft",
    description: "Видит только тренер"
  });
  assert.equal(getTrainerProgramStatusMeta({ programStatus: "assigned" }).label, "Назначена");
  assert.equal(getTrainerProgramStatusMeta({ lifecycleStatus: "archived" }).description, "Нельзя назначить");
  assert.equal(getTrainerProgramStatusMeta({ lifecycleStatus: "unknown" }).id, TRAINER_PROGRAM_STATUSES.DRAFT);
});

test("trainer program status labels are not mojibake", () => {
  for (const status of Object.values(TRAINER_PROGRAM_STATUSES)) {
    const meta = getTrainerProgramStatusMeta({ lifecycleStatus: status });
    assert.doesNotMatch(meta.label, /Ð|Ñ|�/);
    assert.doesNotMatch(meta.description, /Ð|Ñ|�/);
  }
});

test("draft program metadata stays trainer-only until assignment", () => {
  const metadata = buildDraftProgramMetadata({}, {
    nowIso: "2026-07-11T10:00:00.000Z",
    ownerUid: "trainer-1"
  });

  assert.equal(metadata.lifecycleStatus, "draft");
  assert.equal(metadata.visibility, "trainer_draft");
  assert.equal(metadata.publishedAt, "");
  assert.equal(isTrainerProgramClientVisible(metadata), false);
});

test("assignment metadata keeps the reusable template ready and activates the client copy", () => {
  const templatePatch = buildProgramAssignmentMetadata({
    assignedClientIds: ["client-0"]
  }, {
    clientId: "client-1",
    assignedAt: "2026-07-11T10:00:00.000Z",
    assignedByUid: "trainer-1"
  });
  const clientPatch = buildClientProgramLifecycleMetadata({
    assignedAt: "2026-07-11T10:00:00.000Z",
    assignedByUid: "trainer-1"
  });

  assert.equal(templatePatch.lifecycleStatus, "ready");
  assert.equal(templatePatch.visibility, "trainer_library");
  assert.equal(templatePatch.updatedByUid, "trainer-1");
  assert.deepEqual(templatePatch.assignedClientIds, ["client-0", "client-1"]);
  assert.equal(isTrainerProgramClientVisible(templatePatch), false);
  assert.equal(clientPatch.assignedProgramLifecycleStatus, "active");
  assert.equal(clientPatch.assignedProgramVisibility, "client_active");
});

test("archived programs are not assignable", () => {
  assert.equal(isTrainerProgramArchived({ lifecycleStatus: "archived" }), true);
  assert.equal(isTrainerProgramArchived({ lifecycleStatus: "active" }), false);
});
