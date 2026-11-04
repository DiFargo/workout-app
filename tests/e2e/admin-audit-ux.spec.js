import { expect, test } from "./app-test.js";

const fixture = "/tests/e2e/fixtures/admin-workspace.html";
const usersTab = page => page.getByRole("button", { name: "Пользователи и роли", exact: true }).filter({ visible: true });

test("same-name recovery accounts show distinct masked identities and exact selected UID", async ({ page }) => {
  const mutations = [];
  await page.route("**/api/**", route => { mutations.push(route.request().url()); return route.abort(); });
  await page.goto(`${fixture}?duplicateRecovery=1`);
  await usersTab(page).click();
  await page.getByText("Помощь со входом клиента", { exact: true }).click();
  await page.getByRole("button", { name: "Восстановить вход через Telegram", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Восстановить вход через Telegram", exact: true });
  const select = dialog.getByRole("combobox", { name: "Клиент", exact: true });
  await expect(select.locator("option[value='client-1']")).toHaveText(/Анна Ковалёва · an\*\*\*@example.test/);
  await expect(select.locator("option[value='other-client-22222222']")).toHaveText(/Анна Ковалёва · ot\*\*\*@example.test · ID …22222222/);
  await select.selectOption("other-client-22222222");
  await expect(dialog).toContainText("ID: other-client-22222222");
  await expect(dialog.getByLabel("Telegram владельца")).toHaveValue("");
  expect(mutations).toEqual([]);
});

test("directory lifecycle labels never call restricted or archived profiles active", async ({ page }) => {
  await page.goto(`${fixture}?lifecycle=1`);
  await usersTab(page).click();
  const directory = page.getByTestId("admin-users-workspace");
  for (const label of ["Ожидает назначения тренера", "Доступ приостановлен", "Доступ отозван", "Архив", "Неактивен"]) {
    await expect(directory.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(directory.getByText("Активен", { exact: true })).toHaveCount(0);
});

test("role management is separate and actual route requires identity-specific confirmation before mocked POST", async ({ page }) => {
  const calls = [];
  await page.route("**/api/admin/update-user-role", route => {
    calls.push(route.request().postDataJSON());
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, user: { id: "client-1", role: "trainer" } }) });
  });
  await page.goto(`${fixture}?operational=1`);
  const action = page.getByRole("button", { name: "Изменить роль Анна Ковалёва на «Тренер»", exact: true });
  await expect(action).toBeHidden();
  await expect(page.getByRole("button", { name: "Назначить тренера Анна Ковалёва", exact: true })).toBeVisible();
  await page.getByText("Управление ролью", { exact: true }).click();
  page.once("dialog", async dialog => {
    expect(dialog.message()).toContain("ID: client-1");
    expect(dialog.message()).toContain("Это смена роли, а не назначение тренера клиенту");
    await dialog.dismiss();
  });
  await action.click();
  expect(calls).toEqual([]);
  page.once("dialog", dialog => dialog.accept());
  await action.click();
  await expect.poll(() => calls).toEqual([{ uid: "client-1", role: "trainer" }]);
});

test("bot diagnostics and cancelled reconnect never send a webhook request", async ({ page }) => {
  const calls = [];
  await page.route("**/api/telegram/set-webhook", route => { calls.push(route.request().url()); return route.abort(); });
  await page.goto(`${fixture}?hub=1`);
  await expect(page.getByText("Серверное подключение не проверено.", { exact: false })).toBeHidden();
  await page.getByText("Система и Telegram", { exact: true }).click();
  await expect(page.getByText("Серверное подключение не проверено.", { exact: false })).toBeVisible();
  await page.getByText("Диагностика подключения", { exact: true }).click();
  await expect(page.getByText("@zmena_teleg_bot", { exact: true })).toBeVisible();
  await expect(page.getByText("Локальное / тестовое · workout-app-e2e", { exact: true })).toBeVisible();
  await page.getByText("Обслуживание бота", { exact: true }).click();
  await page.getByRole("button", { name: "Переподключить webhook", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Переподключить webhook?", exact: true });
  await expect(dialog).toContainText("@zmena_teleg_bot");
  await expect(dialog).toContainText("workout-app-e2e");
  await expect(dialog).toContainText("Это изменяющая серверная операция");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Переподключить webhook", exact: true }).click();
  await dialog.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Переподключить webhook", exact: true }).click();
  await page.locator("[data-modal-backdrop=true]").click({ position: { x: 1, y: 1 } });
  await expect(dialog).toHaveCount(0);
  expect(calls).toEqual([]);
});

test("busy webhook confirmation blocks Escape backdrop and close; only explicit confirmation sends mocked POST", async ({ page }) => {
  let release;
  const calls = [];
  await page.route("**/api/telegram/set-webhook", async route => {
    calls.push(route.request().postDataJSON());
    await new Promise(resolve => { release = resolve; });
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.goto(`${fixture}?hub=1`);
  await page.getByText("Система и Telegram", { exact: true }).click();
  await page.getByText("Обслуживание бота", { exact: true }).click();
  await page.getByRole("button", { name: "Переподключить webhook", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Переподключить webhook?", exact: true });
  await dialog.getByRole("button", { name: "Подтвердить переподключение", exact: true }).click();
  await expect.poll(() => calls.length).toBe(1);
  await expect(dialog.getByRole("button", { name: "Закрыть подтверждение webhook", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.locator("[data-modal-backdrop=true]").click({ position: { x: 1, y: 1 } });
  await expect(dialog).toBeVisible();
  expect(calls).toEqual([{}]);
  release();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Сервер подтвердил команду переподключения.", { exact: false })).toBeVisible();
});

test("admin fixed controls reserve Telegram insets and recovery remains scrollable in a short viewport", async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 600 });
  await page.goto(fixture);
  await page.evaluate(() => {
    const style = document.documentElement.style;
    style.setProperty("--telegram-safe-area-top", "24px");
    style.setProperty("--telegram-content-safe-area-bottom", "34px");
    style.setProperty("--app-viewport-height", "600px");
  });
  const nav = page.getByRole("navigation", { name: "Разделы админки", exact: true });
  await expect(nav).toHaveCSS("padding-bottom", "34px");
  const header = page.getByTestId("admin-workspace-harness").locator("main > header");
  await expect(header).toHaveCSS("top", "24px");
  await usersTab(page).click();
  await page.getByText("Помощь со входом клиента", { exact: true }).click();
  await page.getByRole("button", { name: "Восстановить вход через Telegram", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Восстановить вход через Telegram", exact: true });
  const geometry = await dialog.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight, overflowY: getComputedStyle(element).overflowY };
  });
  expect(geometry.top).toBeGreaterThanOrEqual(24);
  expect(geometry.bottom).toBeLessThanOrEqual(566);
  expect(geometry.overflowY).toBe("auto");
  expect(geometry.scrollHeight).toBeGreaterThanOrEqual(geometry.clientHeight);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(402);
});
