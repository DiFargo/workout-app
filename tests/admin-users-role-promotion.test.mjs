import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workspaceSource = await readFile(
  new URL("../src/components/admin/AdminUsersWorkspace.jsx", import.meta.url),
  "utf8"
);
const routeSource = await readFile(
  new URL("../src/features/trainer/AdminUsersWorkspaceRoute.jsx", import.meta.url),
  "utf8"
);
const handlerSource = await readFile(
  new URL("../src/features/trainer/trainerAccountAdminHandlers.js", import.meta.url),
  "utf8"
);

test("admin user directory exposes the trainer promotion action only for client accounts", () => {
  assert.match(workspaceSource, /role === "client" && typeof onPromoteToTrainer === "function"/);
  assert.match(workspaceSource, /Назначить тренером/);
  assert.match(workspaceSource, /onPromoteToTrainer=\{onPromoteToTrainer \? promoteToTrainer : undefined\}/);
});

test("admin promotion is confirmed before the server-side role operation is called", () => {
  assert.match(routeSource, /const promoteClientToTrainer = async \(client\) =>/);
  assert.match(routeSource, /title: "Назначить тренером\?"/);
  assert.match(routeSource, /confirmText: "Назначить тренером"/);
  assert.match(routeSource, /await updateAdminUserRole\(\{ uid: targetId, role: "trainer" \}\)/);
  assert.match(routeSource, /onPromoteToTrainer=\{promoteClientToTrainer\}/);
});

test("role update reports an explicit success or failure result to the directory action", () => {
  assert.match(handlerSource, /setAdminClientStatus\(makeTrainer \? "Роль тренера назначена\." : "Роль тренера снята\."\);\s*return true;/);
  assert.match(handlerSource, /setAdminClientStatus\("Не удалось изменить роль тренера\. Проверь права Firestore\."\);\s*return false;/);
});
