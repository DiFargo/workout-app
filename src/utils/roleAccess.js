const normalizeRole = (role) => String(role || "").trim().toLocaleLowerCase("ru");

// UI capabilities use the same current server authority as Functions/rules.
// Existing admins without a version keep access until their first role change.
export function hasCurrentAdminAccess({ claims = {}, profile = {} } = {}) {
  return claims?.admin === true && profile?.role === "admin" &&
    profile.active !== false && profile.archived !== true && profile.accessDisabled !== true &&
    !["revoked", "suspended"].includes(profile.membershipStatus) &&
    (Object.hasOwn(profile, "adminClaimVersion")
      ? typeof profile.adminClaimVersion === "string" && claims.adminClaimVersion === profile.adminClaimVersion
      : !Object.hasOwn(claims, "adminClaimVersion"));
}

export function resolveUserRole({ isAdminClaim, role }) {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === "admin") return isAdminClaim === true ? "admin" : "unresolved";
  if (normalizedRole === "trainer") return "trainer";
  return "client";
}

export function getCanUseAdminFeatures({ isAdminClaim, currentUserRole }) {
  return isAdminClaim === true && normalizeRole(currentUserRole) === "admin";
}

export function getCanUseTrainerFeatures({ isAdminClaim, currentUserRole }) {
  return normalizeRole(currentUserRole) === "trainer" ||
    getCanUseAdminFeatures({ isAdminClaim, currentUserRole });
}
