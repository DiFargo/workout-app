export function getTrainerProgramOwner(currentUid = "", isAdmin = false) {
  return {
    uid: currentUid || "",
    role: isAdmin ? "admin" : "trainer"
  };
}

export function buildTrainerProgramAccessContext({
  currentUid = "",
  currentUserRole = "",
  isAdmin = false
} = {}) {
  return {
    currentUid: String(currentUid || ""),
    currentUserRole: String(currentUserRole || ""),
    isAdmin: Boolean(isAdmin)
  };
}

export function canManageTrainerTemplate(template = {}, context = {}) {
  if (context.isAdmin) return true;

  const currentUid = String(context.currentUid || "");
  return context.currentUserRole === "trainer" &&
    Boolean(currentUid) &&
    template?.ownerUid === currentUid;
}

export function canManageTrainerClientProgram(client = {}, context = {}) {
  if (context.isAdmin) return true;

  const currentUid = String(context.currentUid || "");
  return context.currentUserRole === "trainer" &&
    Boolean(currentUid) &&
    [
      client?.trainerId,
      client?.assignedTrainerId,
      client?.coachId,
      client?.createdByUid
    ].includes(currentUid);
}
