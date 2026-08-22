export function resolveUserRole({ isAdminClaim, role }) {
  const normalizedRole = String(role || "").trim().toLocaleLowerCase("ru");
  if (isAdminClaim) return "admin";
  if (normalizedRole === "trainer") return "trainer";
  if (normalizedRole === "admin") return "admin";
  return "client";
}

export function getCanUseAdminFeatures({ isAdminClaim }) {
  return Boolean(isAdminClaim);
}

export function getCanUseTrainerFeatures({ isAdminClaim, currentUserRole }) {
  return Boolean(isAdminClaim || currentUserRole === "trainer");
}
