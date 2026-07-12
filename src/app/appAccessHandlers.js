export function createAppAccessHandlers({
  auth,
  user,
  isAdminClaim,
  currentUserRole,
  getCanUseAdminFeatures,
  getCanUseTrainerFeatures,
  getTrainerProgramOwner,
  buildTrainerProgramAccessContext,
  canManageTrainerTemplate,
  canManageTrainerClientProgram
}) {
  function canUseAdminFeatures() {
    return getCanUseAdminFeatures({ isAdminClaim });
  }

  function canUseTrainerFeatures() {
    return getCanUseTrainerFeatures({
      isAdminClaim,
      currentUserRole,
      email: auth.currentUser?.email || user?.email || ""
    });
  }

  function getCurrentProgramOwner() {
    return getTrainerProgramOwner(auth.currentUser?.uid || user?.uid || "", canUseAdminFeatures());
  }

  function getCurrentProgramAccessContext() {
    return buildTrainerProgramAccessContext({
      currentUid: auth.currentUser?.uid || user?.uid || "",
      currentUserRole,
      isAdmin: canUseAdminFeatures()
    });
  }

  function canManageTrainingTemplate(template) {
    return canManageTrainerTemplate(template, getCurrentProgramAccessContext());
  }

  function canManageClientProgram(client) {
    return canManageTrainerClientProgram(client, getCurrentProgramAccessContext());
  }

  return {
    canUseAdminFeatures,
    canUseTrainerFeatures,
    getCurrentProgramOwner,
    getCurrentProgramAccessContext,
    canManageTrainingTemplate,
    canManageClientProgram
  };
}
