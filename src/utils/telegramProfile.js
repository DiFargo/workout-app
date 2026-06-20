export function normalizeTelegramUsername(value = "") {
  return String(value || "").trim().replace(/^@+/, "");
}
