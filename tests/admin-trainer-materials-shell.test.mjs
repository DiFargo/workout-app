import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("admin trainer materials stay in the admin workspace while trainer materials keep their own shell", async () => {
  const route = await readFile(new URL("../src/features/trainer/TrainerAdminWorkoutsRoute.jsx", import.meta.url), "utf8");
  const nextRoute = await readFile(new URL("../src/features/trainer/TrainerAdminWorkoutsNextRoute.jsx", import.meta.url), "utf8");
  const workspace = await readFile(new URL("../src/components/admin/AdminWorkoutsNextWorkspace.jsx", import.meta.url), "utf8");

  assert.match(route, /import AdminWorkspace from "\.\.\/\.\.\/components\/admin\/AdminWorkspace"/);
  assert.match(route, /const isAdminTrainerMaterials = hasAdminAccess\(canUseAdminFeatures\) && isTrainerAccount\(selectedTrainer\)/);
  assert.match(route, /function hasAdminAccess\(canUseAdminFeatures\)/);
  assert.match(route, /function isTrainerAccount\(user\)/);
  assert.match(route, /const renderAdminTrainerMaterials = \(content\) =>/);
  assert.match(route, /<AdminWorkspace[\s\S]*?activeSection="users"[\s\S]*?testId="admin-trainer-materials-workspace"/);
  assert.match(route, /К профилю тренера/);
  assert.match(route, /onClick=\{returnToTrainerProfile\}/);
  assert.match(route, /embedded=\{isAdminTrainerMaterials\}/);
  assert.match(route, /if \(isAdminTrainerMaterials\) \{[\s\S]*?renderAdminTrainerMaterials\([\s\S]*?trainerNextRoot/);
  assert.match(route, /<TrainerShell[\s\S]*?\{programPage\}[\s\S]*?<\/TrainerShell>/);
  assert.match(nextRoute, /embedded = false/);
  assert.match(nextRoute, /<AdminWorkoutsNextWorkspace[\s\S]*?embedded=\{embedded\}/);
  assert.match(workspace, /embedded = false/);
  assert.match(workspace, /<TrainerWorkspace[\s\S]*?embedded=\{embedded\}/);
});
