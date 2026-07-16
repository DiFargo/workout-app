export function normalizeTelegramUsername(value = "") {
  return String(value || "").trim().replace(/^@+/, "");
}

export function createTelegramLinkCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function parseTelegramAuthResultFromHash(hashValue = "") {
  try {
    const hash = hashValue || (typeof window !== "undefined" ? window.location.hash : "");
    const params = new URLSearchParams(String(hash || "").replace(/^#/, ""));
    const rawResult = params.get("tgAuthResult");

    if (!rawResult) return null;

    const base64 = rawResult.replace(/-/g, "+").replace(/_/g, "/");
    const paddedBase64 = base64 + "=".repeat((4 - base64.length % 4) % 4);
    const atobFn = typeof window !== "undefined" ? window.atob : globalThis.atob;
    const decoded = decodeURIComponent(escape(atobFn(paddedBase64)));

    return JSON.parse(decoded);
  } catch (error) {
    console.error("Telegram tgAuthResult parse error:", error);
    return null;
  }
}
