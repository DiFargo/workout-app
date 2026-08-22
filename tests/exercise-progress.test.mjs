import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeExerciseProgress,
  getExerciseActualProgress
} from "../src/utils/exerciseProgress.js";

function workout(date, weight, reps, targetReps = "8-10", programId = "program-a", sets = 1) {
  return {
    date,
    assignedProgramId: programId,
    exercises: [{
      name: "Жим лёжа",
      sets: Array.from({ length: sets }, () => ({
        weight,
        reps,
        targetReps,
        completed: true
      }))
    }]
  };
}

test("changed rep range is treated as program adaptation, not regression", () => {
  const result = analyzeExerciseProgress([
    workout("2026-06-01", 20, 10, "8-10"),
    workout("2026-06-08", 18, 12, "10-12")
  ])[0];

  assert.equal(result.status, "adaptation");
  assert.match(result.explanation, /диапазон повторений изменён/);
});

test("more reps at the same weight is progress", () => {
  const result = analyzeExerciseProgress([
    workout("2026-06-01", 20, 10),
    workout("2026-06-08", 20, 12)
  ])[0];

  assert.equal(result.status, "progress");
  assert.ok(result.changes.e1rmPct > 0);
});

test("more weight at the same reps is progress", () => {
  const result = analyzeExerciseProgress([
    workout("2026-06-01", 20, 10),
    workout("2026-06-08", 22.5, 10)
  ])[0];

  assert.equal(result.status, "progress");
  assert.equal(result.changes.weight, 2.5);
});

test("lower weight and reps without a program change is possible regression", () => {
  const result = analyzeExerciseProgress([
    workout("2026-06-01", 20, 10),
    workout("2026-06-08", 18, 8)
  ])[0];

  assert.equal(result.status, "regression");
});

test("additional completed set increases total training volume", () => {
  const result = analyzeExerciseProgress([
    workout("2026-06-01", 20, 10, "8-10", "program-a", 2),
    workout("2026-06-08", 20, 10, "8-10", "program-a", 3)
  ])[0];

  assert.equal(result.status, "progress");
  assert.equal(result.previous.volume, 400);
  assert.equal(result.current.volume, 600);
});

test("volume and percentage use the same actual completed working sets", () => {
  const result = analyzeExerciseProgress([
    workout("2026-06-12", 20, 12, "8-12", "program-a", 3),
    workout("2026-06-27", 18, 15, "8-12", "program-a", 3)
  ])[0];

  assert.equal(result.previous.volume, 720);
  assert.equal(result.current.volume, 810);
  assert.equal(result.changes.volume, 90);
  assert.equal(result.changes.volumePct, 12.5);
  assert.equal(result.changes.reps, 9);
  assert.equal(result.status, "mixed");
});

test("actual entered values win over the trainer plan", () => {
  const first = workout("2026-06-01", 20, 10);
  const second = workout("2026-06-08", 20, 10);
  second.exercises[0].sets[0] = {
    weight: 20,
    reps: 10,
    enteredWeight: 18,
    enteredReps: 15,
    completed: true
  };

  const result = analyzeExerciseProgress([first, second])[0];
  assert.equal(result.current.bestWeight, 18);
  assert.equal(result.current.totalReps, 15);
  assert.equal(result.current.volume, 270);
});

test("warmup and incomplete sets are excluded from progress volume", () => {
  const first = workout("2026-06-01", 20, 10);
  const second = workout("2026-06-08", 20, 10);
  second.exercises[0].sets.push(
    { weight: 50, reps: 10, completed: true, setType: "warmup" },
    { weight: 50, reps: 10, completed: false, setType: "work" }
  );

  const result = analyzeExerciseProgress([first, second])[0];
  assert.equal(result.current.volume, 200);
  assert.equal(result.current.sets, 1);
});

test("per hand weight convention applies one multiplier consistently", () => {
  const first = workout("2026-06-01", 20, 10);
  const second = workout("2026-06-08", 20, 12);
  first.exercises[0].weightMode = "per_hand";
  second.exercises[0].weightMode = "per_hand";

  const result = analyzeExerciseProgress([first, second])[0];
  assert.equal(result.previous.volume, 400);
  assert.equal(result.current.volume, 480);
  assert.equal(result.current.weightConvention, "per_hand");
});

test("actual exercise progress keeps 0, 1, and 2+ completed sessions without inferred statuses", () => {
  const first = workout("2026-06-01", 20, 10);
  const second = workout("2026-06-08", 22.5, 12);
  const exerciseName = first.exercises[0].name;

  const empty = getExerciseActualProgress([first], "Unknown exercise");
  assert.equal(empty.sessionCount, 0);
  assert.equal(empty.lastSession, null);
  assert.equal(empty.comparison.available, false);

  const oneSession = getExerciseActualProgress([first], exerciseName);
  assert.equal(oneSession.sessionCount, 1);
  assert.ok(oneSession.lastSession.date instanceof Date);
  assert.equal(oneSession.lastSession.sets, 1);
  assert.equal(oneSession.lastSession.totalReps, 10);
  assert.equal(oneSession.lastSession.bestWeight, 20);
  assert.equal(oneSession.lastSession.volume, 200);
  assert.equal(oneSession.comparison.available, false);

  const twoSessions = getExerciseActualProgress([second, first], exerciseName);
  assert.equal(twoSessions.sessionCount, 2);
  assert.equal(twoSessions.lastSession.date.toISOString().slice(0, 10), "2026-06-08");
  assert.equal(twoSessions.previousSession.volume, 200);
  assert.equal(twoSessions.lastSession.volume, 270);
  assert.equal(twoSessions.comparison.available, true);
  assert.equal(twoSessions.comparison.volumeDelta, 70);
  assert.equal(twoSessions.comparison.volumePercent, 35);
  assert.equal(twoSessions.comparison.weightDelta, 2.5);
  assert.equal(twoSessions.comparison.repsDelta, 2);
});

test("actual exercise progress reads legacy exercise names, identifiers and completed-set fields", () => {
  const history = [{
    date: "2026-06-12",
    exercises: [{
      id: "leg_press",
      title: "Жим ногами в тренажере",
      actualSets: [{ completedWeight: 110, completedReps: 12, completed: true }]
    }]
  }];

  const result = getExerciseActualProgress(history, {
    id: "leg_press",
    name: "Жим ногами"
  });

  assert.equal(result.sessionCount, 1);
  assert.equal(result.lastSession.bestWeight, 110);
  assert.equal(result.lastSession.totalReps, 12);
});

test("actual progress matches a trainer-approved alternative in legacy history", () => {
  const result = getExerciseActualProgress([{
    date: "2026-06-12",
    actualExercises: [{
      id: "machine_leg_press",
      name: "Жим ногами в тренажёре",
      completedSets: [{ completedWeight: 110, completedReps: 12, completed: true }]
    }]
  }], {
    id: "leg_press",
    name: "Жим ногами",
    trainerAlternatives: [{
      id: "machine_leg_press",
      name: "Жим ногами в тренажёре"
    }]
  });

  assert.equal(result.sessionCount, 1);
  assert.equal(result.lastSession.bestWeight, 110);
  assert.equal(result.lastSession.totalReps, 12);
});

test("actual progress falls back to a nested completed workout when an empty legacy array is present", () => {
  const result = getExerciseActualProgress([{
    date: "2026-06-12",
    exercises: [],
    workoutSnapshot: {
      exercises: [{
        id: "machine_leg_press",
        name: "Жим ногами в тренажёре",
        completedSets: [{ completedWeight: 110, completedReps: 12, completed: true }]
      }]
    }
  }], {
    id: "leg_press",
    trainerAlternatives: [{ id: "machine_leg_press" }]
  });

  assert.equal(result.sessionCount, 1);
  assert.equal(result.lastSession.bestWeight, 110);
});

test("actual progress prefers recorded legacy sets over a parallel planned exercise array", () => {
  const result = getExerciseActualProgress([{
    date: "2026-06-12",
    exercises: [{
      id: "leg_press",
      name: "Жим ногами",
      sets: [{ reps: 12, weight: 110, completed: false }]
    }],
    actualExercises: [{
      id: "leg_press",
      name: "Жим ногами",
      actualSets: [{ actualWeight: 110, actualReps: 12, completed: true }]
    }]
  }], "Жим ногами");

  assert.equal(result.sessionCount, 1);
  assert.equal(result.lastSession.bestWeight, 110);
  assert.equal(result.lastSession.totalReps, 12);
});

test("a matching old history record without completed working sets remains explicit", () => {
  const result = getExerciseActualProgress([{
    date: "2026-06-12",
    exercises: [{ name: "Жим ногами", sets: [{ reps: 12, weight: 110, completed: false }] }]
  }], "Жим ногами");

  assert.equal(result.sessionCount, 0);
  assert.equal(result.matchedHistoryCount, 1);
  assert.equal(result.discardedSessionCount, 1);
});
