import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const WORKOUT_ROUTE_PATH = new URL("../src/features/client/workouts/useWorkoutRunViewModel.js", import.meta.url);
const WORKOUT_STAGE_PATH = new URL("../src/features/client/workouts/WorkoutRunStageView.jsx", import.meta.url);
const WORKOUT_FINISH_PATH = new URL("../src/features/client/workouts/WorkoutFinishStage.jsx", import.meta.url);
const WORKOUT_SAVE_PATH = new URL("../src/features/client/workouts/workoutFirebaseSaveHandlers.js", import.meta.url);

test("post workout feedback opens finish summary before saving client comment", async () => {
  const routeSource = await readFile(WORKOUT_ROUTE_PATH, "utf8");
  const feedbackHandlerMatch = routeSource.match(/const selectPostWorkoutFeedback = useCallback\(\(option\) => \{([\s\S]*?)\}, \[/);

  assert.ok(feedbackHandlerMatch, "Post workout feedback handler should stay explicit in the workout route view model");
  assert.match(feedbackHandlerMatch[1], /setPostWorkoutFeedback\(option\)/);
  assert.match(feedbackHandlerMatch[1], /setPostWorkoutFeedbackOpen\(false\)/);
  assert.match(feedbackHandlerMatch[1], /setCurrentExerciseIndex\(executionSteps\.length \+ 1\)/);
  assert.doesNotMatch(feedbackHandlerMatch[1], /saveWorkoutToFirebase\(option\)/);
});

test("finish summary keeps a private note for basic workouts and a trainer comment for individual plans", async () => {
  const finishSource = await readFile(WORKOUT_FINISH_PATH, "utf8");
  const stageSource = await readFile(WORKOUT_STAGE_PATH, "utf8");
  const saveSource = await readFile(WORKOUT_SAVE_PATH, "utf8");

  assert.match(finishSource, /Заметка о тренировке/);
  assert.match(finishSource, /isBasicWorkout \? "Заметка о тренировке" : "Комментарий тренеру"/);
  assert.match(finishSource, /value=\{workoutClientComment\}/);
  assert.match(finishSource, /onClientCommentChange/);
  assert.match(finishSource, /onClick=\{onFinishWorkout\}/);
  assert.match(stageSource, /if \(postWorkoutFeedback\) \{[\s\S]*?saveWorkoutToFirebase\(postWorkoutFeedback\)/);
  assert.match(saveSource, /personalNote:\s*workoutClientComment\.trim\(\)/);
  assert.match(saveSource, /clientComment:\s*workoutClientComment\.trim\(\)/);
});
