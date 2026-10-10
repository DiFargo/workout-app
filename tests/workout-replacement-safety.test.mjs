import assert from "node:assert/strict";
import { after, test } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";

let cloudWrites = 0;
let cacheWrites = 0;
const cleanup = installRuntimeImports({
  "firebase/firestore": { doc: (_, ...path) => path.join("/"), setDoc: async () => { cloudWrites++; } },
  "/src/utils/userScopedStorage.js": { safeWriteUserJsonStorage: () => { cacheWrites++; } }
});
after(cleanup);
const { createWorkoutRuntimeHandlers } = await import("../src/features/client/workouts/workoutRuntimeHandlers.js");

for (const source of ["basic", "trainer"]) test(`${source} runtime refuses completed replacement without React/cache/cloud writes`, () => {
  cloudWrites = 0; cacheWrites = 0;
  const alternative = { id: "machine_chest_press", name: "Жим от груди в тренажёре" };
  const workout = { id: "day", source, exercises: [{ id: "exercise", name: "Жим штанги лёжа",
    trainerAlternatives: [alternative], sets: [{ completed: true, enteredWeight: "60", enteredReps: "10" }, { reps: 10 }]
  }] };
  const plan = { source, workouts: [workout] };
  const snapshot = structuredClone(plan);
  let stateWrites = 0;
  const handlers = createWorkoutRuntimeHandlers({ plan, workout, db: {}, auth: { currentUser: { uid: "client" } },
    setPlan: () => { stateWrites++; } });
  const replace = source === "basic" ? handlers.replaceBasicWorkoutExercise : handlers.replaceTrainerAssignedWorkoutExercise;
  assert.equal(replace("exercise", alternative), false);
  assert.deepEqual(plan, snapshot);
  assert.equal(stateWrites, 0);
  assert.equal(cacheWrites, 0);
  assert.equal(cloudWrites, 0);
});
