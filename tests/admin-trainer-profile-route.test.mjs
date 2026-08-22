import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const routeSource = await readFile(
  new URL("../src/features/trainer/AdminTrainerProfileRoute.jsx", import.meta.url),
  "utf8"
);
const profileSource = await readFile(
  new URL("../src/components/admin/AdminTrainerProfile.jsx", import.meta.url),
  "utf8"
);

test("admin trainer profile keeps the admin workspace account controls and trainer-filtered back navigation", () => {
  assert.match(routeSource, /openAdminClientsWithFilter\("trainers"\)/);
  assert.match(routeSource, /adminEmail=\{adminEmail \|\| user\?\.email \|\| ""\}/);
  assert.match(routeSource, /onLogout=\{onLogout \|\| logout\}/);
  assert.match(routeSource, /onProfileClick=\{onProfileClick \|\| openProfileAccount\}/);
});

test("admin trainer role downgrade is blocked until assigned-client data is safe", () => {
  assert.match(routeSource, /const assignmentsKnown = Array\.isArray\(adminAllUsersList\)/);
  assert.match(profileSource, /const hasAssignedClients = assignmentsKnown && assignedClientsCount > 0/);
  assert.match(profileSource, /if \(roleChangePending \|\| hasAssignedClients \|\| !assignmentsKnown/);
  assert.match(profileSource, /Сначала переназначьте/);
  assert.match(profileSource, /Доступ и данные не будут изменены/);
  assert.doesNotMatch(profileSource, /Удалить тренера/);
});
