const FILTERS = {
  "unassigned-clients": { id: "unassigned-clients", role: "client", title: "Клиенты без тренера" },
  "pending-invites": { id: "pending-invites", role: "trainer", title: "Ожидают активации" },
  "suspended-trainers": { id: "suspended-trainers", role: "trainer", title: "Ограничен доступ тренеров" }
};

export function getAdminAttentionFilter(value) {
  return Object.hasOwn(FILTERS, value) ? FILTERS[value] : null;
}

// Presentation only. The same predicate feeds overview counts and directory
// results; it does not grant access or replace backend role/assignment checks.
export function matchesAdminAttentionFilter(user, filterId, role, statusId) {
  const filter = getAdminAttentionFilter(filterId);
  if (!filter) return true;
  if (role !== filter.role) return false;
  if (filter.id === "unassigned-clients") {
    const trainerId = String(user?.assignedTrainerId || user?.trainerId || user?.coachId || "").trim();
    return !trainerId && !["blocked", "inactive"].includes(statusId);
  }
  if (filter.id === "suspended-trainers") return statusId === "blocked";
  const lifecycle = String(user?.accountStatus || user?.status || "").trim().toLocaleLowerCase("ru");
  return statusId === "pending" && ["invited", "pending", "created", "ожидает", "приглашён"].includes(lifecycle);
}
