import test from "node:test";
import assert from "node:assert/strict";

import { appendExerciseSets } from "../src/features/trainer/trainerExerciseSetUtils.js";

test("new trainer sets copy every current first-set parameter independently", () => {
  const first = {
    weight: "20",
    reps: "12",
    rpe: "8",
    rir: "2",
    rest: "90 сек",
    tempo: "3-1-1",
    metadata: { side: "left" }
  };
  const result = appendExerciseSets([first], { count: 3 });

  assert.equal(result.length, 4);
  assert.deepEqual(result[1], first);
  assert.deepEqual(result[2], first);
  assert.deepEqual(result[3], first);
  assert.notEqual(result[1], first);
  assert.notEqual(result[1].metadata, first.metadata);

  result[1].weight = "25";
  result[1].metadata.side = "right";
  assert.equal(result[0].weight, "20");
  assert.equal(result[0].metadata.side, "left");
});

test("later additions use the latest first set without changing existing copies", () => {
  const initial = appendExerciseSets([{ weight: "20", reps: "12" }]);
  initial[0] = { weight: "22.5", reps: "10" };
  const result = appendExerciseSets(initial);

  assert.deepEqual(result[1], { weight: "20", reps: "12" });
  assert.deepEqual(result[2], { weight: "22.5", reps: "10" });
});

test("an empty first set creates an empty independent row", () => {
  const result = appendExerciseSets([]);
  assert.deepEqual(result, [{}, {}]);
  assert.notEqual(result[0], result[1]);
});

test("trainer can explicitly add an empty set", () => {
  const result = appendExerciseSets([{ weight: "20", reps: "12" }], { empty: true });
  assert.deepEqual(result, [{ weight: "20", reps: "12" }, {}]);
});

test("exercise-level defaults become independent copied set parameters", () => {
  const result = appendExerciseSets(
    [{ weight: "20", reps: "12" }],
    { defaults: { rest: "90 сек", tempo: "3-1-1" } }
  );
  assert.deepEqual(result[1], { weight: "20", reps: "12", rest: "90 сек", tempo: "3-1-1" });
});
