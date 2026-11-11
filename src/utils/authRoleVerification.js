export const ROLE_VERIFICATION_TIMEOUT_MS = 15000;
export const ROLE_VERIFICATION_RETRY_DELAYS_MS = [1000, 2500];

// Only known transport failures are retried. A denied or invalid profile never
// becomes a client role merely because a request failed.
export function classifyRoleVerificationError(error) {
  const code = String(error?.code || error?.message || "").replace(/^firestore\//, "");
  if (["unavailable", "deadline-exceeded", "role_verification_timeout", "auth/network-request-failed"].includes(code)) return "connection";
  if (["unauthenticated", "auth/user-token-expired", "auth/invalid-user-token", "auth/user-disabled", "auth/id-token-revoked"].includes(code)) return "session";
  if (["permission-denied", "role_claims_invalid"].includes(code)) return "access";
  if (["role_profile_missing", "role_profile_invalid"].includes(code)) return "profile";
  return "verification";
}
