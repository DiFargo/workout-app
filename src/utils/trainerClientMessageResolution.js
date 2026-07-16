const SUCCESSFUL_MESSAGE_STATUSES = new Set([
  "sent",
  "saved",
  "delivered",
  "read",
  "processed"
]);

function normalizeText(value = "") {
  return String(value || "").trim().toLowerCase();
}

function parseDetails(details) {
  if (details && typeof details === "object" && !Array.isArray(details)) return details;
  if (typeof details !== "string" || !details.trim()) return {};

  try {
    const parsed = JSON.parse(details);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function addSourceCommentIds(target, source = {}) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return;

  const sourceCommentId = typeof source.sourceCommentId === "string"
    ? source.sourceCommentId.trim()
    : "";
  if (sourceCommentId) target.add(sourceCommentId);

  if (!Array.isArray(source.sourceCommentIds)) return;
  source.sourceCommentIds.forEach((value) => {
    const sourceCommentIdFromList = typeof value === "string" ? value.trim() : "";
    if (sourceCommentIdFromList) target.add(sourceCommentIdFromList);
  });
}

export function getTrainerClientMessageResolvedIds({
  telegramMessages = [],
  trainerEvents = []
} = {}) {
  const resolvedIds = new Set();

  (Array.isArray(telegramMessages) ? telegramMessages : []).forEach((message) => {
    if (!message || typeof message !== "object" || Array.isArray(message)) return;
    if (!SUCCESSFUL_MESSAGE_STATUSES.has(normalizeText(message.status))) return;

    addSourceCommentIds(resolvedIds, message);
    addSourceCommentIds(resolvedIds, message.replyContext);
  });

  (Array.isArray(trainerEvents) ? trainerEvents : []).forEach((event) => {
    if (!event || typeof event !== "object" || Array.isArray(event)) return;
    if (normalizeText(event.type) !== "client_message_resolution") return;

    addSourceCommentIds(resolvedIds, event);
    addSourceCommentIds(resolvedIds, parseDetails(event.details));
  });

  return resolvedIds;
}
