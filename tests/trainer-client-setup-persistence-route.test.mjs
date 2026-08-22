import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("dashboard client workspace receives the setup progress persistence handler", async () => {
  const source = await readFile(
    new URL("../src/features/trainer/TrainerDashboardWorkspaceRoute.jsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /saveTrainerClientSetupProgress/);
  assert.match(source, /onSaveClientSetupProgress=\{saveTrainerClientSetupProgress\}/);
});
