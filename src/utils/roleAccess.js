export function resolveUserRole({ isAdminClaim, role }) {
  if (isAdminClaim) return "admin";
  if (role === "trainer") return "trainer";
  if (role === "admin") return "admin";
  return "client";
}

export function getCanUseAdminFeatures({ isAdminClaim }) {
  return Boolean(isAdminClaim);
}

export function getCanUseTrainerFeatures({ isAdminClaim, currentUserRole }) {
  return Boolean(isAdminClaim || currentUserRole === "trainer");
}
