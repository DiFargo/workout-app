import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const apiSource = await readFile(
  new URL("../src/features/trainer/adminOperationalApi.js", import.meta.url),
  "utf8"
);
const usersRouteSource = await readFile(
  new URL("../src/features/trainer/AdminUsersWorkspaceRoute.jsx", import.meta.url),
  "utf8"
);
const trainerRouteSource = await readFile(
  new URL("../src/features/trainer/AdminTrainerProfileRoute.jsx", import.meta.url),
  "utf8"
);
const trainerProfileSource = await readFile(
  new URL("../src/components/admin/AdminTrainerProfile.jsx", import.meta.url),
  "utf8"
);
const hubSource = await readFile(
  new URL("../src/components/admin/AdminPanelHub.jsx", import.meta.url),
  "utf8"
);

test("admin operational API keeps privileged lifecycle requests behind authorized POST calls", () => {
  assert.match(apiSource, /fetchAuthorizedWithTimeout/);
  assert.match(apiSource, /"\/api\/admin\/assign-client"/);
  assert.match(apiSource, /"\/api\/admin\/set-user-access"/);
  assert.match(apiSource, /"\/api\/admin\/update-user-role"/);
  assert.match(apiSource, /"\/api\/admin\/trainer-invite"/);
});

test("administrator can assign or clear a trainer assignment from the user directory", () => {
  assert.match(usersRouteSource, /<AdminClientAssignmentModal/);
  assert.match(usersRouteSource, /assignAdminClient\(\{ clientId, trainerId:/);
  assert.match(usersRouteSource, /onAssignTrainer=\{openClientAssignment\}/);
});

test("trainer profile exposes safe reassignment, access and invitation lifecycle controls", () => {
  assert.match(trainerRouteSource, /manageAdminTrainerInvite\(\{ uid: trainerId, action: "status" \}\)/);
  assert.match(trainerRouteSource, /setAdminUserAccess\(\{ uid: trainerId, action \}\)/);
  assert.match(trainerRouteSource, /assignAdminClient\(\{ clientId, trainerId: targetTrainerId \}\)/);
  assert.match(trainerRouteSource, /reassignClientsToUid: targetTrainerId/);
  assert.match(trainerProfileSource, /onDemoteWithReassignment/);
  assert.match(trainerProfileSource, /confirmDemoteWithReassignment/);
  assert.match(trainerProfileSource, /Переназначить клиентов/);
  assert.match(trainerProfileSource, /Отправить повторно/);
  assert.match(trainerProfileSource, /Приостановить/);
});

test("admin overview surfaces action queue entries for assignments, invitations and access", () => {
  assert.match(hubSource, /id: "unassigned-clients"/);
  assert.match(hubSource, /id: "pending-invites"/);
  assert.match(hubSource, /id: "suspended-trainers"/);
  assert.match(hubSource, /onOverviewQueueAction=\{openQueueItem\}/);
});
