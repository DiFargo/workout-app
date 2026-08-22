export function getRoleAccessGateState({ isLoggedIn, currentUserRole }) {
  if (!isLoggedIn) return "";
  if (currentUserRole === "resolving") return "resolving";
  if (currentUserRole === "unresolved") return "unresolved";
  return "";
}

export function getFirstSetupCompletedLocally({
  isLoggedIn,
  userId,
  storageKey,
  requiredVersion
}) {
  if (!isLoggedIn || !userId) return false;

  try {
    return (
      localStorage.getItem(storageKey) === `${userId}:${requiredVersion}` ||
      localStorage.getItem(`${storageKey}:${userId}`) === requiredVersion
    );
  } catch {
    return false;
  }
}

export function getFirstSetupGateState({
  isLoggedIn,
  userId,
  firstSetupProfileHydrated,
  currentUserRole,
  firstSetupCompletedInSession,
  firstSetupCompletedInCloud,
  hasRequiredAiNutritionProfileFields,
  storageKey,
  requiredVersion
}) {
  const firstSetupCompletedLocally = getFirstSetupCompletedLocally({
    isLoggedIn,
    userId,
    storageKey,
    requiredVersion
  });

  return {
    firstSetupStillResolving: Boolean(
      isLoggedIn &&
      !firstSetupProfileHydrated
    ),
    firstSetupRequiredNow: Boolean(
      isLoggedIn &&
      firstSetupProfileHydrated &&
      currentUserRole === "client" &&
      !firstSetupCompletedInSession &&
      !firstSetupCompletedInCloud &&
      !hasRequiredAiNutritionProfileFields &&
      !firstSetupCompletedLocally
    )
  };
}
