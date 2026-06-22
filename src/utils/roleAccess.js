export function getCanUseAdminFeatures({ isAdminClaim }) {
  return Boolean(isAdminClaim);
}

export function getCanUseTrainerFeatures({ isAdminClaim, currentUserRole }) {
  return Boolean(isAdminClaim || currentUserRole === "trainer");
}
