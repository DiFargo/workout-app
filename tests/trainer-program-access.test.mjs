import test from "node:test";
import assert from "node:assert/strict";

import {
  canManageTrainerClientProgram,
  canManageTrainerTemplate,
  getTrainerProgramOwner
} from "../src/utils/trainerProgramAccess.js";

test("trainer program owner uses admin role only for admin users", () => {
  assert.deepEqual(getTrainerProgramOwner("trainer-1", false), { uid: "trainer-1", role: "trainer" });
  assert.deepEqual(getTrainerProgramOwner("admin-1", true), { uid: "admin-1", role: "admin" });
});

test("trainer can manage only owned templates", () => {
  const context = { currentUid: "trainer-1", currentUserRole: "trainer", isAdmin: false };

  assert.equal(canManageTrainerTemplate({ ownerUid: "trainer-1" }, context), true);
  assert.equal(canManageTrainerTemplate({ ownerUid: "trainer-2" }, context), false);
  assert.equal(canManageTrainerTemplate({ ownerUid: "trainer-2" }, { ...context, isAdmin: true }), true);
});

test("trainer can manage only assigned client programs", () => {
  const context = { currentUid: "trainer-1", currentUserRole: "trainer", isAdmin: false };

  assert.equal(canManageTrainerClientProgram({ trainerId: "trainer-1" }, context), true);
  assert.equal(canManageTrainerClientProgram({ assignedTrainerId: "trainer-1" }, context), true);
  assert.equal(canManageTrainerClientProgram({ coachId: "trainer-1" }, context), true);
  assert.equal(canManageTrainerClientProgram({ createdByUid: "trainer-1" }, context), true);
  assert.equal(canManageTrainerClientProgram({ trainerId: "trainer-2" }, context), false);
  assert.equal(canManageTrainerClientProgram({ trainerId: "trainer-2" }, { ...context, isAdmin: true }), true);
});
