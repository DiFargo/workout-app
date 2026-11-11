import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("trainer client detail keeps the questionnaire gate unless explicit admin capability is granted", async () => {
  const source = await readFile(
    new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /const clientQuestionnaireCompleted = hasCompletedClientQuestionnaire/);
  assert.match(source, /canViewPendingClient = false/);
  assert.match(source, /if \(!clientQuestionnaireCompleted && canViewPendingClient !== true\) \{/);
  assert.match(source, /canViewPendingClient=\{canViewPendingClient\}/);
  assert.match(source, /trainerNextClientQuestionnaireGate/);
  assert.match(source, /Пока нет данных/);
});

test("pending client capability comes from verified admin access on both workspace routes", async () => {
  for (const route of ["TrainerClientsWorkspaceRoute", "TrainerDashboardWorkspaceRoute"]) {
    const source = await readFile(new URL(`../src/features/trainer/${route}.jsx`, import.meta.url), "utf8");
    assert.match(source, /canViewPendingClient=\{canUseAdminFeatures\(\) === true\}/);
  }
});
