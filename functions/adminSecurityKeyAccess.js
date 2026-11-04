export const ADMIN_SECURITY_KEY_SESSION_MS = 8 * 60 * 60 * 1000;

// Proof is issued only in this sign-in's custom token, never in global user claims.
export function hasAdminSecurityKeyProof(token = {}, profile = {}, now = Date.now()) {
  if (!Object.hasOwn(profile, "adminSecurityKeyRequired") || profile.adminSecurityKeyRequired === false) return true;
  return profile.adminSecurityKeyRequired === true &&
    typeof profile.adminSecurityKeyVersion === "string" && profile.adminSecurityKeyVersion.length > 0 &&
    token.adminSecurityKeyVersion === profile.adminSecurityKeyVersion &&
    token.adminSecurityKeyRoleVersion === (Object.hasOwn(profile, "adminClaimVersion") ? profile.adminClaimVersion : "legacy") &&
    Number.isSafeInteger(token.adminSecurityKeyUntil) &&
    token.adminSecurityKeyUntil > now && token.adminSecurityKeyUntil <= now + ADMIN_SECURITY_KEY_SESSION_MS;
}
