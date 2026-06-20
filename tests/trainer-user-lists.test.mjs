import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTrainerUserLists,
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
