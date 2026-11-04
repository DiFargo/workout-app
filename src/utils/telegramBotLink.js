export function buildTelegramBotLinkUrl(botUsername, code) {
  const username = String(botUsername || "").trim().replace(/^@/, "").toLowerCase();
  const token = String(code || "");
  if (!/^[a-z0-9_]{5,32}$/.test(username) || !/^[A-Za-z0-9_-]{20,60}$/.test(token)) return "";
  return `https://t.me/${username}?start=${token}`;
}

export function openTelegramBotLink(event, url, hostWindow = window) {
  if (event?.type !== "click" || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
      (event.button !== undefined && event.button !== 0)) return false;
  try {
    const parsed = new URL(url);
    const expected = buildTelegramBotLinkUrl(parsed.pathname.slice(1), parsed.searchParams.get("start"));
    if (!expected || parsed.href !== expected) return false;
    const webApp = hostWindow?.Telegram?.WebApp;
    if (typeof webApp?.openTelegramLink !== "function") return false;
    if (webApp.openTelegramLink(expected) === false) return false;
    event.preventDefault?.();
    return true;
  } catch {
    // Keep the real anchor's normal browser navigation if the SDK is absent or fails.
    return false;
  }
}
