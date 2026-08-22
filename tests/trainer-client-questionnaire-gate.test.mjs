import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("trainer client detail locks the workspace until the onboarding questionnaire is complete", async () => {
  const source = await readFile(
    new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /const clientQuestionnaireCompleted = hasCompletedClientQuestionnaire/);
  assert.match(source, /if \(!clientQuestionnaireCompleted\) \{/);
  assert.match(source, /trainerNextClientQuestionnaireGate/);
  assert.match(source, /Пока нет данных/);
});
