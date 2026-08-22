import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const modalSource = await readFile(
  new URL("../src/components/admin/AdminTrainerInviteModal.jsx", import.meta.url),
  "utf8"
);
const routeSource = await readFile(
  new URL("../src/features/trainer/AdminUsersWorkspaceRoute.jsx", import.meta.url),
  "utf8"
);
const workspaceSource = await readFile(
  new URL("../src/components/admin/AdminUsersWorkspace.jsx", import.meta.url),
  "utf8"
);

test("admin user directory exposes a dedicated trainer invite flow", () => {
  assert.match(workspaceSource, /onInviteTrainer/);
  assert.match(routeSource, /<AdminTrainerInviteModal/);
  assert.match(routeSource, /onInviteTrainer=\{openTrainerInvite\}/);
});

test("trainer invite uses the authorized admin endpoint and safely refreshes the directory", () => {
  assert.match(routeSource, /fetchAuthorizedWithTimeout\("\/api\/admin\/create-trainer-invite"/);
  assert.match(routeSource, /setAdminAllUsersList\(\(previousUsers\)/);
  assert.match(routeSource, /Promise\.resolve\(\)\.then\(\(\) => loadUsers\(\)\)/);
});

test("trainer activation link can be copied from the success sheet", () => {
  assert.match(modalSource, /shareUrl \|\| invite\?\.activationUrl \|\| invite\?\.inviteUrl/);
  assert.match(modalSource, /navigator\.clipboard\?\.writeText\(inviteUrl\)/);
  assert.match(modalSource, /createPortal\(modal, document\.body\)/);
});
