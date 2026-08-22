import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const handlerPath = new URL("../src/features/client/workouts/workoutOpenHandlers.js", import.meta.url);
const quizPath = new URL("../src/features/client/workouts/BasicWorkoutQuizPage.jsx", import.meta.url);

test("basic plan is committed to cloud before the client enters workouts", async () => {
  const source = await readFile(handlerPath, "utf8");

  assert.match(source, /async function applyBasicWorkoutPlan\(/);
  assert.match(source, /await basicPlanBatch\.commit\(\);/);
  assert.match(
    source,
    /await basicPlanBatch\.commit\(\);[\s\S]*?setPlan\(nextPlanState\);[\s\S]*?setPage\(APP_PAGES\.WORKOUTS\);/
  );
  assert.doesNotMatch(source, /cloudSyncState:\s*["']local_only["']/);
});

test("basic plan draft stays available when the cloud save is rejected", async () => {
  const source = await readFile(quizPath, "utf8");

  assert.match(source, /const result = await onApplyBasicWorkoutPlan\(nextQuiz\);/);
  assert.match(source, /result\?\.cloudSaved === false/);
  assert.match(source, /generatedPlan:\s*scheduledPlan/);
  assert.match(
    source,
    /result\?\.cloudSaved === false[\s\S]*?return;[\s\S]*?onBasicWorkoutQuizChange\([\s\S]*?generatedPlan:\s*undefined/
  );
  assert.match(source, /Нет подключения к интернету\. План не сохранён в облаке/);
});
