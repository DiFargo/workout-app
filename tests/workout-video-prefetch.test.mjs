import assert from "node:assert/strict";
import test from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";

const cleanup = installRuntimeImports();
const { upcomingWorkoutVideoPreviews } = await import("../src/features/client/workouts/workoutVideoPrefetch.js");
test.after(cleanup);

const exercise = (id, videoPosterTime = 2.1) => ({ id, name: id, video: `gs://app/exercise-videos/${id}.mp4`, videoPosterTime, sets: [{}] });
const workout = { exercises: [exercise("a"), exercise("b"), exercise("c"), exercise("d")] };

test("готовность и разминка подготавливают только два первых кадра", () => {
  for (const workoutStarted of [false, true]) {
    assert.deepEqual(upcomingWorkoutVideoPreviews({ workout, workoutStarted, currentExerciseIndex: 0 }), [
      { source: workout.exercises[0].video, previewTime: 2.1 },
      { source: workout.exercises[1].video, previewTime: 2.1 }
    ]);
  }
});

test("во время упражнения подготавливаются следующие, а не текущий ролик", () => {
  assert.deepEqual(upcomingWorkoutVideoPreviews({ workout, workoutStarted: true, currentExerciseIndex: 1 }), [
    { source: workout.exercises[1].video, previewTime: 2.1 },
    { source: workout.exercises[2].video, previewTime: 2.1 }
  ]);
  assert.deepEqual(upcomingWorkoutVideoPreviews({ workout, workoutStarted: true, currentExerciseIndex: 4 }), []);
  assert.deepEqual(upcomingWorkoutVideoPreviews({ workout, isWorkoutSaved: true }), []);
});

test("нулевой выбранный кадр сохранён, отсутствие кадра не скачивает видео", () => {
  const items = { exercises: [exercise("a", null), exercise("b", 0), { id: "no-video" }, exercise("c")] };
  assert.deepEqual(upcomingWorkoutVideoPreviews({ workout: items }), [
    { source: items.exercises[1].video, previewTime: 0 }, { source: items.exercises[3].video, previewTime: 2.1 }
  ]);
});

test("одинаковые кадры групп и текущего упражнения не повторяются", () => {
  const grouped = { exercises: [exercise("a"), { ...exercise("b"), video: workout.exercises[0].video }, exercise("c"), exercise("d")] };
  assert.deepEqual(upcomingWorkoutVideoPreviews({ workout: grouped, workoutStarted: true, currentExerciseIndex: 1 }), [
    { source: grouped.exercises[2].video, previewTime: 2.1 }, { source: grouped.exercises[3].video, previewTime: 2.1 }
  ]);
});

test("используется текущая замена медиа без изменения исходной тренировки", () => {
  const before = structuredClone(workout);
  const previews = upcomingWorkoutVideoPreviews({ workout, resolveExercise: item => ({ ...item, videoPosterTime: 4 }) });
  assert.equal(previews[0].previewTime, 4);
  assert.deepEqual(workout, before);
});
