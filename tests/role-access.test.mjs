import test from "node:test";
import assert from "node:assert/strict";
import { createAppAccessHandlers } from "../src/app/appAccessHandlers.js";

import {
  getCanUseAdminFeatures,
  getCanUseTrainerFeatures,
  hasCurrentAdminAccess,
  resolveUserRole
} from "../src/utils/roleAccess.js";

test("email alone never grants trainer access", () => {
  assert.equal(
    resolveUserRole({
      isAdminClaim: false,
      role: "",
      email: "zahar.rusenko2000@gmail.com"
    }),
    "client"
  );
  assert.equal(
    getCanUseTrainerFeatures({
      isAdminClaim: false,
      currentUserRole: "client",
      email: "zahar.rusenko2000@gmail.com"
    }),
    false
  );
});

test("unknown client email keeps client access", () => {
  assert.equal(
    resolveUserRole({
      isAdminClaim: false,
      role: "",
      email: "client@example.com"
    }),
    "client"
  );
  assert.equal(
    getCanUseTrainerFeatures({
      isAdminClaim: false,
      currentUserRole: "client",
      email: "client@example.com"
    }),
    false
  );
});

test("verified admin claim and current server role keep admin and trainer access", () => {
  assert.equal(
    resolveUserRole({
      isAdminClaim: true,
      role: "admin",
      email: "client@example.com"
    }),
    "admin"
  );
  assert.equal(
    getCanUseTrainerFeatures({
      isAdminClaim: true,
      currentUserRole: "admin",
      email: "client@example.com"
    }),
    true
  );
});

test("a stale admin claim never overrides a client/trainer role or unresolved bootstrap", () => {
  for (const role of ["client", "resolving", "unresolved", ""]) {
    assert.equal(getCanUseAdminFeatures({ isAdminClaim: true, currentUserRole: role }), false);
    assert.equal(getCanUseTrainerFeatures({ isAdminClaim: true, currentUserRole: role }), false);
  }
  assert.equal(resolveUserRole({ isAdminClaim: true, role: "client" }), "client");
  assert.equal(resolveUserRole({ isAdminClaim: true, role: "trainer" }), "trainer");
  assert.equal(getCanUseAdminFeatures({ isAdminClaim: true, currentUserRole: "trainer" }), false);
  assert.equal(getCanUseTrainerFeatures({ isAdminClaim: true, currentUserRole: "trainer" }), true);
  assert.equal(resolveUserRole({ isAdminClaim: false, role: "admin" }), "unresolved");
  assert.equal(getCanUseAdminFeatures({ isAdminClaim: false, currentUserRole: "admin" }), false);
  assert.equal(getCanUseTrainerFeatures({ isAdminClaim: false, currentUserRole: "admin" }), false);
});

test("server profile and token versions must agree; legacy admins work without a migration", () => {
  const legacy = { role: "admin" };
  assert.equal(hasCurrentAdminAccess({ claims: { admin: true }, profile: legacy }), true);
  assert.equal(hasCurrentAdminAccess({ claims: { admin: true }, profile: { role: "client" } }), false);
  assert.equal(hasCurrentAdminAccess({ claims: {}, profile: legacy }), false);
  assert.equal(hasCurrentAdminAccess({ claims: { admin: "true" }, profile: legacy }), false);
  assert.equal(hasCurrentAdminAccess({ claims: { admin: true, adminClaimVersion: "old" }, profile: legacy }), false);
  const versioned = { role: "admin", adminClaimVersion: "current" };
  for (const claims of [{ admin: true }, { admin: true, adminClaimVersion: "old" }, { admin: false, adminClaimVersion: "current" }]) {
    assert.equal(hasCurrentAdminAccess({ claims, profile: versioned }), false);
  }
  const claims = { admin: true, adminClaimVersion: "current" };
  assert.equal(hasCurrentAdminAccess({ claims, profile: versioned }), true);
  for (const patch of [{ active: false }, { archived: true }, { accessDisabled: true }, { membershipStatus: "revoked" }, { membershipStatus: "suspended" }]) {
    assert.equal(hasCurrentAdminAccess({ claims, profile: { ...versioned, ...patch } }), false);
  }
});

test("stored trainer role is normalized before access is resolved", () => {
  assert.equal(
    resolveUserRole({ isAdminClaim: false, role: " Trainer " }),
    "trainer"
  );
});

test("app capability handlers pass current role through admin, trainer and programme access", () => {
  for (const [role, claim, canAdmin, canTrainer] of [
    ["admin", true, true, true], ["admin", false, false, false],
    ["client", true, false, false], ["unresolved", true, false, false], ["trainer", false, false, true]
  ]) {
    const handlers = createAppAccessHandlers({ auth: { currentUser: { uid: "actor" } }, user: { uid: "actor" },
      isAdminClaim: claim, currentUserRole: role, getCanUseAdminFeatures, getCanUseTrainerFeatures,
      getTrainerProgramOwner: (uid, isAdmin) => ({ uid, isAdmin }),
      buildTrainerProgramAccessContext: (value) => value,
      canManageTrainerTemplate: (_template, context) => context.isAdmin,
      canManageTrainerClientProgram: (_client, context) => context.isAdmin });
    assert.equal(handlers.canUseAdminFeatures(), canAdmin, role);
    assert.equal(handlers.canUseTrainerFeatures(), canTrainer, role);
    assert.equal(handlers.getCurrentProgramOwner().isAdmin, canAdmin, role);
    assert.equal(handlers.getCurrentProgramAccessContext().isAdmin, canAdmin, role);
    assert.equal(handlers.canManageTrainingTemplate({}), canAdmin, role);
    assert.equal(handlers.canManageClientProgram({}), canAdmin, role);
  }
});
