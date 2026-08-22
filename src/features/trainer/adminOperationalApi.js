import { fetchAuthorizedWithTimeout } from "../../utils/apiClient";

const ADMIN_OPERATION_TIMEOUT_MS = 20000;

export function getAdminOperationalUserId(user) {
  return String(user?.id || user?.uid || "").trim();
}

export async function requestAdminOperation(path, payload) {
  const response = await fetchAuthorizedWithTimeout(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {})
  }, ADMIN_OPERATION_TIMEOUT_MS);
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(result?.error || "admin_operation_failed");
    error.code = result?.error || "admin_operation_failed";
    error.status = response.status;
    error.details = result;
    throw error;
  }

  return result;
}

export function assignAdminClient({ clientId, trainerId }) {
  return requestAdminOperation("/api/admin/assign-client", {
    clientId,
    ...(trainerId ? { trainerId } : {})
  });
}

export function setAdminUserAccess({ uid, action }) {
  return requestAdminOperation("/api/admin/set-user-access", { uid, action });
}

export function updateAdminUserRole({ uid, role, reassignClientsToUid }) {
  return requestAdminOperation("/api/admin/update-user-role", {
    uid,
    role,
    ...(reassignClientsToUid ? { reassignClientsToUid } : {})
  });
}

export function manageAdminTrainerInvite({ uid, action }) {
  return requestAdminOperation("/api/admin/trainer-invite", { uid, action });
}
