// Presentation parity with assertAssignableTrainer/isActiveMemberData. The server
// remains authoritative; pending invitations are intentionally assignable.
export function isAdminAssignableTrainer(user = {}) {
  const role = String(user?.role || "").trim().toLowerCase();
  const status = String(user?.accountStatus || user?.status || "").trim().toLowerCase();
  const membership = String(user?.membershipStatus || "").trim().toLowerCase();
  return Boolean(String(user?.id || user?.uid || "").trim()) && role === "trainer"
    && user.active !== false && user.archived !== true && user.accessDisabled !== true && user.disabled !== true
    && user.accountAccessStatus !== "awaiting_trainer"
    && !["revoked", "suspended"].includes(membership)
    && !["disabled", "blocked", "suspended", "inactive", "revoked", "отозван", "archived"].includes(status);
}
