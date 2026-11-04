export function isRecentCustomEmailSession(tokenResult, now = Date.now()) {
  const authenticatedAt = Number(tokenResult?.claims?.auth_time) * 1000;
  return tokenResult?.signInProvider === "custom" && Number.isFinite(authenticatedAt) &&
    authenticatedAt > 0 && authenticatedAt <= now + 30000 && now - authenticatedAt <= 5 * 60 * 1000;
}
