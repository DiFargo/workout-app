import test from "node:test";
import assert from "node:assert/strict";
import { assertBasicWorkoutAccess, hasBasicWorkoutAccess } from "../functions/basicWorkoutAccess.js";
import { createWorkoutEntryNavigation } from "../src/features/client/workouts/workoutEntryNavigation.js";
import { compactWorkoutLoadingData } from "../functions/clientLoadingSnapshot.js";

test("only an explicit active administrator grant enables basic training", () => {
  for (const profile of [{}, { basicWorkoutPlan: { source: "basic" } }, { basicWorkoutAccess: "true" },
    { workoutModePreference: { mode: "basic" } }, { basicWorkoutAccess: true, active: false },
    { basicWorkoutAccess: true, archived: true }, { basicWorkoutAccess: true, accessDisabled: true },
    { basicWorkoutAccess: true, membershipStatus: "suspended" }]) {
    assert.equal(hasBasicWorkoutAccess(profile), false);
    assert.throws(() => assertBasicWorkoutAccess(profile), { code: "basic_workout_access_required", status: 403 });
  }
  assert.equal(hasBasicWorkoutAccess({ role: "client", basicWorkoutAccess: true }), true);
});

test("denied access never changes plan, mode or page even when a basic plan is cached", async () => {
  const events = [];
  const navigation = createWorkoutEntryNavigation({ auth: { currentUser: { uid: "client" } }, db: {},
    user: { uid: "client" }, plan: { source: "basic", workouts: [{ id: "saved" }] },
    workoutModePreference: { mode: "basic" }, verifyBasicAccess: async () => { throw new Error("denied"); },
    onBasicAccessDenied: message => events.push(message),
    setWorkoutModePreference: () => events.push("mode"), setWorkoutModeRemember: () => events.push("remember"),
    setPlan: () => events.push("plan"), setPage: () => events.push("page") });
  assert.equal(await navigation.openSavedBasicWorkoutsOrQuiz(), false);
  assert.equal(await navigation.openBasicWorkoutQuiz(), false);
  assert.deepEqual(events, ["denied", "denied"]);
});

test("compact loading preserves the explicit grant without deriving one from a saved plan", () => {
  const empty = { docs: [] };
  assert.equal(compactWorkoutLoadingData({ role: "client", basicWorkoutAccess: true }, empty, empty).profile.basicWorkoutAccess, true);
  assert.equal(Object.hasOwn(compactWorkoutLoadingData({ role: "client", basicWorkoutPlan: {} }, empty, empty).profile, "basicWorkoutAccess"), false);
});
