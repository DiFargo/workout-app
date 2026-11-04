const INTERNAL_EMAIL_DOMAINS = new Set([
  "invite.tren-85720.app", "invite.tren-85720-staging.app",
  "telegram.tren-85720.app", "telegram.tren-85720-staging.app"
]);

// Presentation only. Never rewrite the Firebase Auth identity. The profile's
// historical emailIsInternal flag can outlive a successful personal-email change.
export function getAccountRecoveryEmail(value) {
  const email = String(value || "").trim();
  const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase();
  return INTERNAL_EMAIL_DOMAINS.has(domain) ? "" : email;
}
