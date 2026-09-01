function getText(value = "") {
  return String(value || "").trim();
}

export function getTrainerClientFirstName(client = {}) {
  const label = getText(
    client?.name ||
    client?.displayName ||
    client?.fullName ||
    client?.email?.split("@")[0]
  );
  return label.split(/\s+/)[0] || "";
}

export function normalizeTrainerClientProgramName(value = "", fallback = "") {
  const name = getText(value).replace(/\s+/g, " ").slice(0, 80);
  return name || getText(fallback).slice(0, 80);
}

export function buildTrainerClientProgramName(templateName = "", client = {}) {
  const sourceName = getText(templateName).replace(/^программа\s+/i, "") || "Тренировка";
  const firstName = getTrainerClientFirstName(client);
  return normalizeTrainerClientProgramName(
    `Программа ${sourceName}${firstName ? ` — ${firstName}` : ""}`
  );
}
