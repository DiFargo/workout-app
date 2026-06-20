import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAdminClientCsvLines,
  buildTrainerClientExportRows,
  trainerExportRowsToCsv
} from "../src/utils/trainerClientExport.js";

test("admin client csv lines include workout and nutrition totals", () => {
  const lines = buildAdminClientCsvLines([
    {
      date: "2026-06-20",
      workout: 'Плечи "А"',
      durationSeconds: 3600,
      postWorkoutFeedback: { title: "Хорошо" }
    }
  ], [
    {
      date: "2026-06-20",
      totals: { calories: 1200.4, protein: 90.6, fat: 42.1, carbs: 180.9 },
      score: 8
    }
  ]);

  assert.equal(lines[0], "type,date,name,calories,protein,fat,carbs,duration,feedback");
  assert.equal(lines[1], 'workout,2026-06-20,"Плечи ""А""",,,,,3600,Хорошо');
  assert.equal(lines[2], 'nutrition,2026-06-20,"day totals",1200,91,42,181,,score 8');
});

test("trainer client export rows include measurements and csv quoting", () => {
  const rows = buildTrainerClientExportRows(
    [{ completedAt: "2026-06-19", workoutName: "Спина", readiness: { title: "Норма" } }],
    [{ createdAt: "2026-06-18", values: { weight: 89.5 } }],
    [{ date: "2026-06-17", totals: { calories: 2000, protein: 150, fat: 60, carbs: 220 }, score: 9 }]
  );

  assert.deepEqual(rows[0], ["type", "date", "name", "calories", "protein", "fat", "carbs", "duration", "details"]);
  assert.equal(rows[1][2], "Спина");
  assert.equal(rows[2][2], "Замер");
  assert.equal(rows[2][8], "weight 89.5");
  assert.match(trainerExportRowsToCsv(rows), /"nutrition","2026-06-17","day totals","2000"/);
});
