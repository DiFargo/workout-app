import test from "node:test";
import assert from "node:assert/strict";

import {
  getCanUseTrainerFeatures,
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

test("admin claim keeps admin role and trainer access", () => {
  assert.equal(
    resolveUserRole({
      isAdminClaim: true,
      role: "client",
      email: "client@example.com"
    }),
    "admin"
  );
  assert.equal(
    getCanUseTrainerFeatures({
      isAdminClaim: true,
      currentUserRole: "client",
      email: "client@example.com"
    }),
    true
  );
});

test("stored trainer role is normalized before access is resolved", () => {
  assert.equal(
    resolveUserRole({ isAdminClaim: false, role: " Trainer " }),
    "trainer"
  );
});
