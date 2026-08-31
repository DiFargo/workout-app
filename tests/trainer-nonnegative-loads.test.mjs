import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { applyTrainerProgramAssignmentLoadAdjustments } from "../src/utils/trainerProgramAssignmentAdjustment.js";

test("trainer load adjustments never lower an exercise below its planned weight", async () => {
  const [setupFlow, adjustmentModal] = await Promise.all([
    readFile("src/components/trainer/TrainerClientSetupFlowModal.jsx", "utf8"),
    readFile("src/components/trainer/TrainerProgramAssignmentAdjustmentModal.jsx", "utf8")
  ]);
  const source = [{ exercises: [{ name: "Тяга блока", requiresWeight: true, sets: [{ weight: "25" }] }] }];

  assert.match(setupFlow, /min="0"[\s\S]*?sanitizeExerciseWeightInput\(event\.target\.value\)/);
  assert.match(adjustmentModal, /type="number"[\s\S]*?min="0"[\s\S]*?step="0\.5"/);
  assert.equal(
    applyTrainerProgramAssignmentLoadAdjustments(source, { "тяга блока": "-2.5" })[0].exercises[0].sets[0].weight,
    "25"
  );
});
