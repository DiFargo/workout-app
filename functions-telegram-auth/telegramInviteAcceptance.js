function normalizeUsername(value) {
  const username = String(value || "").trim().replace(/^@/, "");
  if (!username) return "";
  return /^[A-Za-z0-9_]{5,32}$/.test(username) ? username.toLowerCase() : null;
}

export function getTelegramInviteAcceptanceError({
  invite = null,
  profile = null,
  identity = null,
  clientInvite = null,
  telegramUser = null,
  now = Date.now()
} = {}) {
  if (!invite || invite.inviteKind !== "client" || invite.role !== "client" || !invite.uid || !invite.trainerId) {
    return "telegram-invite-invalid";
  }

  const status = String(invite.status || "").trim().toLowerCase();
  const telegramUserId = String(telegramUser?.id || "").trim();
  const acceptedAgain = status === "accepted" && String(invite.acceptedTelegramUserId || "") === telegramUserId;
  if (status !== "started" && !acceptedAgain) {
    return status === "accepted" ? "telegram-invite-already-used" : "telegram-invite-not-started";
  }

  const expiresAt = Date.parse(String(invite.expiresAt || ""));
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return "telegram-invite-expired";

  if (!/^\d{1,16}$/.test(telegramUserId) || String(invite.telegramUserId || "") !== telegramUserId) {
    return "telegram-invite-account-mismatch";
  }

  const targetUsername = normalizeUsername(invite.telegramUsername || "");
  const currentUsername = normalizeUsername(telegramUser?.username || "");
  if (targetUsername === null || currentUsername === null) return "telegram-invite-invalid";
  if (!targetUsername || currentUsername !== targetUsername) return "telegram-invite-username-mismatch";

  if (!profile || String(profile.role || "").toLowerCase() !== "client" ||
      profile.active === false || profile.archived === true || profile.accessDisabled === true ||
      profile.membershipStatus === "revoked" || profile.membershipStatus === "suspended" ||
      ![profile.trainerId, profile.assignedTrainerId, profile.coachId].map(String).includes(String(invite.trainerId))) {
    return "telegram-invite-account-unavailable";
  }

  const clientInviteStatus = String(clientInvite?.status || "active").toLowerCase();
  const acceptedClientInvite = clientInviteStatus === "accepted" && String(clientInvite.acceptedUid || "") === String(invite.uid);
  if (!clientInvite || (!acceptedClientInvite && !["active", "created"].includes(clientInviteStatus)) ||
      String(clientInvite.authUid || "") !== String(invite.uid) ||
      String(clientInvite.trainerId || "") !== String(invite.trainerId)) {
    return "telegram-invite-invalid";
  }

  if (identity?.uid && String(identity.uid) !== String(invite.uid)) return "telegram-invite-account-mismatch";
  const linkedTelegramIds = [profile.telegramUserId, profile.telegram?.telegramUserId]
    .map(value => String(value || "").trim())
    .filter(Boolean);
  if (linkedTelegramIds.some(value => value !== telegramUserId)) return "telegram-invite-account-mismatch";

  return "";
}
