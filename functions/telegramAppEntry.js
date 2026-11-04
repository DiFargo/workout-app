export function buildTelegramMenuButton(url) {
  let appUrl;
  try {
    appUrl = new URL(String(url || "").trim());
  } catch {
    throw new Error("Telegram app menu requires a valid HTTPS URL");
  }
  if (appUrl.protocol !== "https:" || appUrl.username || appUrl.password) {
    throw new Error("Telegram app menu requires a valid HTTPS URL");
  }
  return {
    type: "web_app",
    text: "Открыть приложение",
    web_app: { url: appUrl.toString() }
  };
}

export async function ensureTelegramAppMenu({ token, url, chatId }, fetchImpl = fetch) {
  const menuButton = buildTelegramMenuButton(url);
  if (!String(token || "").trim()) throw new Error("Telegram bot token is required");
  try {
    const response = await fetchImpl(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        menu_button: menuButton,
        ...(chatId ? { chat_id: chatId } : {})
      }),
      signal: AbortSignal.timeout(15000)
    });
    const result = await response.json();
    if (!response.ok || result?.ok !== true) throw new Error("Telegram menu request failed");
    return result;
  } catch {
    throw new Error("Unable to configure Telegram app menu");
  }
}
