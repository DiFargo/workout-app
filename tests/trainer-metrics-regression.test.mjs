import { test, after } from "node:test";
import assert from "node:assert/strict";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
const cleanup = installRuntimeImports(); after(cleanup);
const { getTrainerAssignmentProgress, buildTrainerDashboardSummary } = await import("../src/utils/trainerClientSummary.js");
const { buildTrainerClientListItems, buildTrainerActionCenter } = await import("../src/utils/trainerActionCenter.js");
const { buildAiCoachResult } = await import("../src/utils/aiCoachResult.js");

test("legacy completions use the same assignment as the editor, ignoring stale root counts", () => {
  const client = { assignedProgramId: "real", assignedWorkoutCount: 9, assignedProgramUpdatedAt: "new-version" };
  const workouts = Array.from({ length: 8 }, (_, i) => ({ id: `day-${i}`, assignedProgramId: "real", assignedProgramUpdatedAt: "new-version" }));
  const history = workouts.slice(0, 4).map((item) => ({ id: `history-${item.id}`, workoutId: item.id, assignedProgramId: "real", assignedProgramUpdatedAt: "old-version" }));
  const counts = getTrainerAssignmentProgress(client, workouts, [...history, history[0]]);
  assert.deepEqual(counts, { assignedWorkoutCount: 8, completedWorkoutCount: 4 });
});

test("test clients remain discoverable but do not affect overview metrics or the action center", () => {
  const clients = [{ id: "real" }, { id: "test", isTest: true }, { id: "archive", archived: true }];
  assert.deepEqual(buildTrainerDashboardSummary(clients).summaryItems.map((item) => item.client.id), ["real"]);
  assert.deepEqual(buildTrainerClientListItems(clients, {}, { filter: "test" }).map((item) => item.client.id), ["test"]);
  assert.equal(buildTrainerActionCenter(clients).items?.some((item) => item.client?.id === "test") ?? false, false);
});

test("a long absence is not presented as measured recovery", () => {
  const result = buildAiCoachResult("recovery", { history: [{ id: "old", date: "2020-01-01", exercises: [] }] });
  assert.equal(result.status, "Нет свежих записей");
  assert.equal(result.score, null);
  assert.ok(!result.actions.join(" ").includes("обычную силовую"));
});
