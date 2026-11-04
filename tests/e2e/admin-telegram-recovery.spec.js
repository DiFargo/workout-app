import { expect, test } from "./app-test.js";

test("admin explicitly confirms existing client and Telegram owner before copying a one-time recovery link", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const requests = [];
  await page.route("**/api/telegram/create-link-code", async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, code: "admin-recovery-test-token", botStartUrl: "https://t.me/OwnsetBot?start=admin-recovery-test-token", expiresAt: new Date(Date.now() + 600000).toISOString() }) });
  });
  await page.goto("/tests/e2e/fixtures/admin-workspace.html");
  await page.getByRole("button", { name: "Пользователи и роли", exact: true }).filter({ visible: true }).click();
  await page.getByText("Помощь со входом клиента", { exact: true }).click();
  await page.getByRole("button", { name: "Восстановить вход через Telegram", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Восстановить вход через Telegram" });
  await expect(dialog).toContainText("Проверьте, что это Telegram владельца. Ссылка даёт доступ к этому аккаунту.");
  await dialog.getByRole("combobox", { name: "Клиент", exact: true }).selectOption("client-1");
  await expect(dialog).toContainText("Восстанавливаем доступ к аккаунту: Анна Ковалёва · an***@example.test · ID …client-1");
  await expect(dialog).toContainText("ID: client-1");
  await expect(dialog.getByLabel("Telegram владельца")).toHaveValue("");
  expect(requests).toEqual([]);
  await dialog.getByLabel("Telegram владельца").fill("@Anna_Owner");
  await dialog.getByRole("button", { name: "Создать одноразовую ссылку" }).click();
  await expect(dialog.getByTestId("admin-telegram-recovery-link")).toContainText("https://t.me/OwnsetBot?start=admin-recovery-test-token");
  await expect(dialog).toContainText("Анна Ковалёва");
  await expect(dialog).toContainText("@anna_owner");
  await expect(dialog).toContainText("не более 10 минут");
  expect(requests).toEqual([{ targetUid: "client-1", expectedTelegramUsername: "anna_owner" }]);
  await dialog.getByRole("button", { name: "Скопировать ссылку" }).click();
  await expect(dialog.getByRole("button", { name: "Ссылка скопирована" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("https://t.me/OwnsetBot?start=admin-recovery-test-token");
  await dialog.getByRole("button", { name: "Закрыть восстановление Telegram" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Восстановить вход через Telegram", exact: true }).click();
  await expect(page.getByLabel("Telegram владельца")).toHaveValue("");
  await expect(page.getByRole("combobox", { name: "Клиент", exact: true })).toHaveValue("");
});
