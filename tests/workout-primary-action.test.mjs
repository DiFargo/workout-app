import assert from "node:assert/strict";
import test from "node:test";
import { getWorkoutPrimaryAction } from "../src/utils/workoutPrimaryAction.js";
import { getWorkoutExecutionSteps } from "../src/utils/workoutPlanNormalization.js";

test("completion and advancing are separate actions without prescription mutation", () => {
  const sets = Array.from({ length: 3 }, () => ({ reps: 12, weight: "30", completed: false }));
  const original = structuredClone(sets);
  for (let index = 0; index < 3; index += 1) {
    let action = getWorkoutPrimaryAction({ sets, selectedSetIndex: index });
    assert.equal(action.kind, "complete");
    assert.equal(action.label, "Завершить подход");
    assert.equal(action.selectedIndex, index);
    sets[index] = { ...sets[index], completed: true };
    action = getWorkoutPrimaryAction({ sets, selectedSetIndex: index });
    assert.equal(action.selectedIndex, index, "Completion retains selection");
    assert.equal(action.kind, index < 2 ? "next-set" : "next-exercise");
    if (index < 2) {
      assert.equal(action.targetIndex, index + 1);
      assert.equal(action.label, `Перейти к подходу ${index + 2} из 3`);
    }
  }
  assert.deepEqual(sets.map(({ completed: _completed, ...set }) => set), original.map(({ completed: _completed, ...set }) => set));
  assert.equal(getWorkoutPrimaryAction({ sets, selectedSetIndex: 2, isLastExercise: true }).label, "Завершить тренировку");
});

test("review returns to the current set without marking a future or old set", () => {
  const sets = [{ completed: true }, { completed: true }, { completed: false }];
  assert.deepEqual(getWorkoutPrimaryAction({ sets, selectedSetIndex: 0 }), {
    kind: "select", label: "К текущему подходу", selectedIndex: 0, targetIndex: 2, disabled: false
  });
  assert.equal(getWorkoutPrimaryAction({ sets, selectedSetIndex: 1 }).kind, "next-set");
  assert.equal(getWorkoutPrimaryAction({ sets }).selectedIndex, 2);
  sets[0].completed = false; // Legacy gap must not unlock a later approach.
  assert.equal(getWorkoutPrimaryAction({ sets, selectedSetIndex: 2 }).kind, "select");
  assert.equal(getWorkoutPrimaryAction({ sets, selectedSetIndex: 2 }).targetIndex, 0);
});

test("triset CTA advances execution steps A1 B1 C1 A2 B2 C2, not all sets of A", () => {
  const group = { id: "g", type: "group", groupMode: "triset", rounds: 2, exerciseIds: ["a", "b", "c"] };
  const workout = { taskBlocks: [group], exercises: group.exerciseIds.map((id, index) => ({
    id, taskBlockId: group.id, taskBlockType: "group", taskBlockConfig: group,
    taskBlockExerciseIndex: index, taskBlockExerciseCount: 3,
    sets: [{ completed: false }, { completed: false }]
  })) };
  const steps = getWorkoutExecutionSteps(workout);
  for (const [position, step] of steps.entries()) {
    const sets = workout.exercises[step.exerciseIndex].sets;
    const input = { sets, visibleSetIndexes: [step.setIndex], isLastExercise: position === steps.length - 1 };
    assert.equal(getWorkoutPrimaryAction(input).kind, "complete");
    sets[step.setIndex].completed = true;
    assert.equal(getWorkoutPrimaryAction(input).kind, "next-exercise");
    assert.equal(getWorkoutPrimaryAction(input).label, position === 5 ? "Завершить тренировку" : "К следующему упражнению");
  }
});

test("group boundaries and empty exercises remain safe", () => {
  const blocked = getWorkoutPrimaryAction({ sets: [{ completed: false }, { completed: false }], visibleSetIndexes: [1] });
  assert.equal(blocked.disabled, true);
  assert.notEqual(blocked.kind, "complete");
  assert.equal(getWorkoutPrimaryAction({}).kind, "next-exercise");
});

test("next-set label uses the actual pending target and full exercise count", () => {
  const sets = [{ completed: true }, { completed: true }, { completed: false }, { completed: false }];
  const original = structuredClone(sets);
  const action = getWorkoutPrimaryAction({ sets, visibleSetIndexes: [0, 2, 3], selectedSetIndex: 0 });
  assert.equal(action.kind, "next-set");
  assert.equal(action.targetIndex, 2);
  assert.equal(action.label, "Перейти к подходу 3 из 4");
  assert.deepEqual(sets, original);
});
