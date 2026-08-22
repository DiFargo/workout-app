import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTrainerUserLists,
  isCurrentTrainerClient,
  normalizeTrainerClientRecord
} from "../src/utils/trainerUserLists.js";

test("trainer client records default to client role", () => {
  assert.deepEqual(normalizeTrainerClientRecord({ id: "u1", email: "a@example.com" }), {
    id: "u1",
    email: "a@example.com",
    role: "client"
  });
});

test("trainer user lists deduplicate and sort users", () => {
  const { users } = buildTrainerUserLists([
    { id: "b", name: "Мария", role: "client" },
    { id: "a", name: "Алексей", role: "client" },
    { id: "b", name: "Мария новая", role: "client" }
  ]);

  assert.deepEqual(users.map((item) => item.id), ["a", "b"]);
  assert.equal(users[1].name, "Мария новая");
});

test("regular trainer lists only client records and excludes admin email", () => {
  const { clients } = buildTrainerUserLists([
    { id: "client", email: "client@example.com" },
    { id: "trainer", email: "trainer@example.com", role: "trainer" },
    { id: "admin", email: "admin@example.com", role: "client" }
  ], { adminEmail: "admin@example.com" });

  assert.deepEqual(clients.map((item) => item.id), ["client"]);
});

test("admin lists clients and trainers but excludes admin email", () => {
  const { clients } = buildTrainerUserLists([
    { id: "client", email: "client@example.com", role: "client" },
    { id: "trainer", email: "trainer@example.com", role: "trainer" },
    { id: "admin", email: "admin@example.com", role: "admin" }
  ], { isAdmin: true, adminEmail: "admin@example.com" });

  assert.deepEqual(clients.map((item) => item.id), ["client", "trainer"]);
});

test("explicit reassignment prevents a previous trainer from seeing a legacy client", () => {
  const reassignedClient = {
    id: "client-1",
    role: "client",
    createdByUid: "old-trainer",
    trainerAssignmentState: "assigned",
    assignedTrainerId: "new-trainer",
    trainerId: "new-trainer",
    coachId: "new-trainer"
  };

  assert.equal(isCurrentTrainerClient(reassignedClient, { trainerUid: "old-trainer" }), false);
  assert.equal(isCurrentTrainerClient(reassignedClient, { trainerUid: "new-trainer" }), true);
});

test("explicit unassignment overrides a legacy creator link", () => {
  assert.equal(isCurrentTrainerClient({
    id: "client-1",
    role: "client",
    createdByUid: "trainer-1",
    trainerAssignmentState: "unassigned",
    assignedTrainerId: "",
    trainerId: "",
    coachId: ""
  }, { trainerUid: "trainer-1" }), false);
});

test("a stale trainer mirror never authorizes a client card by itself", () => {
  assert.equal(isCurrentTrainerClient({
    id: "client-1",
    role: "client",
    trainerLinkOnly: true,
    trainerId: "trainer-1"
  }, { trainerUid: "trainer-1" }), false);
});
