import { useEffect } from "react";

const TRAINER_AUTO_LOAD_PAGES = new Set(["admin", "adminUsers", "adminWorkouts"]);

export function useTrainerAutoLoadEffect({
  currentUserRole,
  isAdminClaim,
  page,
  user,
  canUseTrainerFeatures,
  loadAdminTrainingTemplates,
  loadUsers
}) {
  useEffect(() => {
    if (!TRAINER_AUTO_LOAD_PAGES.has(page) || !canUseTrainerFeatures()) return;

    loadUsers();
    loadAdminTrainingTemplates();
    // Loader identities change with the orchestration context. The access and page
    // keys are the intended reload boundary; including loaders would create a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, isAdminClaim, currentUserRole, user?.uid, user?.email]);
}
