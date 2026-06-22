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
  }, [page, isAdminClaim, currentUserRole, user?.uid, user?.email]);
}
