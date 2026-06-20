export function getClientTelegramProfile(client = {}) {
  const telegram = client.telegram || {};

  return {
    ...telegram,
    connected: Boolean(
      telegram.connected ||
      client.telegramConnected ||
      telegram.username ||
      client.telegramUsername ||
      telegram.telegramUserId ||
      client.telegramUserId
    ),
    username: telegram.username || client.telegramUsername || "",
    displayName: telegram.displayName || client.telegramDisplayName || client.telegramUsername || "",
    notificationsEnabled: telegram.notificationsEnabled !== false && client.telegramNotificationsEnabled !== false
  };
}
