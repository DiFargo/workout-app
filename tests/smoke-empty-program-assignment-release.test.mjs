import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyProgramSmokeFixtures, isOwnedEmptyProgramSmokePath, parseEmptyProgramSmokeArgs, safeEmptyProgramSmokeError } from "../scripts/smoke-empty-program-assignment-release.mjs";

const flags = ["--run", "--allow-production", "--project=tren-85720", "--expected-version=3.0.900"];
test("empty-program smoke requires exact explicit Production/version without credential or path overrides", () => {
  assert.equal(parseEmptyProgramSmokeArgs(flags, {})["output-dir"], "artifacts/remediation-3.0.900");
  for (const args of [[], flags.slice(1), flags.filter(arg => arg !== "--allow-production"), [...flags, "--run"], [...flags, "--output-dir=../outside"],
    flags.map(arg => arg.replace("tren-85720", "other-project")), flags.map(arg => arg.replace("3.0.900", "3.0.899"))]) assert.throws(() => parseEmptyProgramSmokeArgs(args, {}));
  for (const key of ["FIREBASE_TOKEN", "GOOGLE_APPLICATION_CREDENTIALS", "FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "GCLOUD_PROJECT"])
    assert.throws(() => parseEmptyProgramSmokeArgs(flags, { [key]: "not-used" }));
});

test("smoke user writes stay in the exact owned tree, not neighbouring users or traversal", () => {
  assert.equal(isOwnedEmptyProgramSmokePath("own", "users/own"), true);
  assert.equal(isOwnedEmptyProgramSmokePath("own", "users/own/workouts/day"), true);
  for (const path of ["users/owner", "users/other", "users/own/../other", "users/own//day", "users/own/./day", "subscriptionUsageLedger/own"])
    assert.equal(isOwnedEmptyProgramSmokePath("own", path), false);
  assert.equal(isOwnedEmptyProgramSmokePath("../own", "users/../own"), false);
});

test("fixtures use separate durable assignments and protect current plan/calendar/subscription from deletion", () => {
  const f = createEmptyProgramSmokeFixtures("0123456789abcdef01234567", "owned-trainer", "2026-10-30T10:00:00.000Z");
  assert.equal(new Set(Object.values(f.keys)).size, 5);
  assert.equal(f.workouts.length, 6);
  assert.equal(f.workouts.filter(w => w.data.assignedProgramAddedAt === f.keys.empty.slice(5)).length, 2);
  assert.equal(f.workouts.filter(w => w.id.startsWith("empty_")).every(w => !w.data.completed && !w.data.startedAt && w.data.assignedProgramLifecycleStatus === "active" && !w.data.assignedProgramArchivedCalendarEntries), true);
  assert.equal(f.history.data.workoutId, "historical_day");
  assert.equal(f.clientPatch.assignedProgramAddedAt, f.keys.active.slice(5));
  assert.deepEqual(f.clientPatch.workoutCalendar.plannedWorkouts.map(w => w.workoutId), ["active_day"]);
  assert.equal(f.clientPatch.subscription.usedSessions, 0);
  assert.equal(f.history.data.date < f.clientPatch.subscription.startDate, true);
  assert.throws(() => createEmptyProgramSmokeFixtures("bad", "owned-trainer"));
});

test("error output never serializes raw errors or credentials", () => {
  assert.deepEqual(safeEmptyProgramSmokeError(new Error("secret token")), { code: "operation-failed" });
  assert.deepEqual(safeEmptyProgramSmokeError({ smokeCode: "cleanup-failed", token: "secret" }), { code: "cleanup-failed" });
});
