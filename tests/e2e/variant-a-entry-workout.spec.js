import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { failOnRuntimeErrors } from "./runtime-errors.js";
import { isolateGoogleAuthTransport } from "./app-test.js";

test.beforeEach(async ({ page }) => {
  await isolateGoogleAuthTransport(page);
  await page.route("https://telegram.org/js/**", route => route.abort());
});

test("chosen email method opens a compact focused form and preserves the draft", async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Войти в Zmena", exact: true })).toBeVisible();
  const methods = page.getByRole("group", { name: "Способ входа" });
  await methods.getByRole("button", { name: "Telegram", exact: true }).click();
  await methods.getByRole("button", { name: "Email или логин", exact: true }).click();
  await expect(page.getByLabel("Email или логин", { exact: true })).toBeFocused();
  await page.getByLabel("Email или логин", { exact: true }).fill("my_login");
  await page.getByLabel("Пароль", { exact: true }).fill("unsent-password");
  await expect(page.getByRole("button", { name: "Войти через Google", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Открыть бота в Telegram" })).toHaveCount(0);
  const input = await page.getByLabel("Email или логин", { exact: true }).boundingBox();
  // The first focused field must fit in the upper half and submit stay reachable.
  expect(input.y).toBeLessThan(page.viewportSize().height / 2);
  await expect(page.getByLabel("Email или логин", { exact: true })).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("button", { name: "Войти", exact: true })).toBeInViewport({ ratio: 1 });
  await mkdir("artifacts/variant-a-preview", { recursive: true });
  await page.screenshot({ path: "artifacts/variant-a-preview/email-login-402.png" });
  await methods.getByRole("button", { name: "Telegram", exact: true }).click();
  await expect(methods.getByRole("button", { name: "Telegram", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: "Открыть бота в Telegram" })).toBeVisible();
  await methods.getByRole("button", { name: "Email или логин", exact: true }).click();
  await expect(page.getByLabel("Email или логин", { exact: true })).toHaveValue("my_login");
  await expect(page.getByLabel("Пароль", { exact: true })).toHaveValue("unsent-password");
  await page.getByRole("button", { name: "Забыли пароль?", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Восстановить пароль", exact: true })).toBeVisible();
  await expect(page.getByLabel("Email или логин", { exact: true })).toHaveValue("my_login");
  await page.getByRole("button", { name: "Назад", exact: true }).click();
  await page.getByRole("button", { name: "Создать аккаунт", exact: true }).click();
  await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
  await expect(page.getByRole("heading", { name: "Создать аккаунт" })).toBeVisible();
  await page.getByRole("button", { name: "Назад", exact: true }).click();
  await expect(page.getByLabel("Email или логин", { exact: true })).toHaveValue("my_login");
  await expect(page.getByLabel("Пароль", { exact: true })).toHaveValue("unsent-password");
  assertNoErrors();
});

test("pending access explains the next step and copies only this account's identifier", async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async text => { window.__copiedId = text; } } }));
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto("/tests/e2e/fixtures/variant-a-entry.html");
  await expect(page.getByRole("heading", { name: "Как получить доступ" })).toBeVisible();
  await expect(page.getByText(/Сейчас идёт закрытое тестирование/)).toBeVisible();
  await expect(page.getByText(/Нет тренера или приглашения\? Назначение не происходит автоматически/)).toBeVisible();
  await expect(page.getByLabel("Разделы пока закрыты")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Основные разделы" })).toHaveCount(0);
  await page.getByRole("button", { name: "Скопировать идентификатор аккаунта" }).click();
  expect(await page.evaluate(() => window.__copiedId)).toBe("my_fitness_account");
  await expect(page.getByText("Скопировано — отправьте тренеру.", { exact: true })).toBeVisible();
  // A08 adds the no-invitation recovery instructions; both actions must remain
  // reachable by normal scrolling rather than require a fixed first-screen Y.
  for (const name of ["Проверить доступ", "Выйти"]) {
    const action = page.getByRole("button", { name, exact: true });
    await action.scrollIntoViewIfNeeded();
    await expect(action).toBeInViewport({ ratio: 1 });
    await expect(action).toBeEnabled();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await mkdir("artifacts/variant-a-preview", { recursive: true });
  await page.screenshot({ path: "artifacts/variant-a-preview/pending-access-402.png" });
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await expect(page.getByText("Вы вышли", { exact: true })).toBeVisible();
  assertNoErrors();
});

test("Telegram and Android Back close the top dialog first and respect a busy dialog", async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.addInitScript(() => {
    const handlers = new Set();
    window.__telegramBack = () => [...handlers].forEach(handler => handler());
    window.Telegram = { WebApp: { BackButton: { onClick: handler => handlers.add(handler), offClick: handler => handlers.delete(handler), show() {}, hide() {} } } };
  });
  await page.goto("/tests/e2e/fixtures/variant-a-entry.html?mode=back");
  await page.getByRole("button", { name: "Открыть окно", exact: true }).click();
  await page.getByRole("button", { name: "Открыть верхнее", exact: true }).click();
  await page.getByRole("button", { name: "Начать операцию" }).click();
  await page.evaluate(() => window.__telegramBack());
  await expect(page.getByRole("dialog", { name: "Верхнее окно", exact: true })).toBeVisible();
  await expect(page.getByTestId("route-backs")).toHaveText("0");
  await page.getByRole("button", { name: "Завершить операцию" }).click();
  await page.evaluate(() => window.__telegramBack());
  await expect(page.getByRole("dialog", { name: "Верхнее окно", exact: true })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Нижнее окно", exact: true })).toBeVisible();
  await page.evaluate(() => history.back());
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("route-backs")).toHaveText("0");
  await page.getByRole("button", { name: "Открыть окно", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("route-backs")).toHaveText("0");
  assertNoErrors();
});

async function installCountedTelegramBack(page, late = false) {
  await page.addInitScript(({ lateSdk }) => {
    const handlers = new Set();
    const calls = { show: 0, hide: 0, onClick: 0, offClick: 0 };
    let visible = false;
    const back = {
      show() { calls.show += 1; visible = true; },
      hide() { calls.hide += 1; visible = false; },
      onClick(handler) { calls.onClick += 1; handlers.add(handler); },
      offClick(handler) { calls.offClick += 1; handlers.delete(handler); }
    };
    window.__backStats = () => ({ ...calls, handlers: handlers.size, visible });
    window.__telegramBack = () => [...handlers].forEach(handler => handler());
    window.__installTelegramBack = () => { window.Telegram = { WebApp: { BackButton: back } }; };
    if (!lateSdk) window.__installTelegramBack();
  }, { lateSdk: late });
}

test("Telegram Back stays visible across workout timer rerenders and route or modal updates", async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await installCountedTelegramBack(page);
  await page.goto("/tests/e2e/fixtures/variant-a-entry.html?mode=stable-back");
  const stats = () => page.evaluate(() => window.__backStats());
  await expect(page.getByTestId("stable-back-state")).toHaveText("workouts:0");
  await expect.poll(stats).toEqual({ show: 1, hide: 0, onClick: 1, offClick: 0, handlers: 1, visible: true });
  for (let tick = 1; tick <= 4; tick += 1) {
    await page.getByRole("button", { name: "Обновить таймер", exact: true }).click();
    await expect(page.getByTestId("stable-back-state")).toHaveText(`workouts:${tick}`);
    expect(await stats()).toEqual({ show: 1, hide: 0, onClick: 1, offClick: 0, handlers: 1, visible: true });
  }
  await page.getByRole("button", { name: "Открыть тренировку", exact: true }).click();
  await expect(page.getByTestId("stable-back-state")).toHaveText("workoutDetail:4");
  await page.evaluate(() => window.__telegramBack());
  await expect(page.getByTestId("stable-back-result")).toHaveText("workoutDetail:4");
  await page.getByRole("button", { name: "Открыть sheet", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await stats()).toEqual({ show: 1, hide: 0, onClick: 1, offClick: 0, handlers: 1, visible: true });
  await page.evaluate(() => window.__telegramBack());
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("stable-back-result")).toHaveText("workoutDetail:4");
  await page.getByRole("button", { name: "Открыть тренировки", exact: true }).click();
  await expect(page.getByTestId("stable-back-state")).toHaveText("workouts:4");
  expect(await stats()).toEqual({ show: 1, hide: 0, onClick: 1, offClick: 0, handlers: 1, visible: true });
  await page.getByRole("button", { name: "Открыть главную", exact: true }).click();
  await expect.poll(stats).toMatchObject({ visible: false, handlers: 0, show: 1 });
  await page.getByRole("button", { name: "Открыть тренировки", exact: true }).click();
  await expect.poll(stats).toMatchObject({ visible: true, handlers: 1, show: 2 });
  const beforeUnmount = await stats();
  await page.getByRole("button", { name: "Размонтировать экран", exact: true }).click();
  await expect.poll(stats).toMatchObject({ visible: false, handlers: 0, show: 2 });
  expect((await stats()).hide).toBeGreaterThan(beforeUnmount.hide);
  expect((await stats()).offClick).toBeGreaterThan(beforeUnmount.offClick);
  assertNoErrors();
});

test("Telegram Back handles late SDK readiness without duplicate visibility or handlers", async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await installCountedTelegramBack(page, true);
  await page.goto("/tests/e2e/fixtures/variant-a-entry.html?mode=stable-back");
  await expect(page.getByTestId("stable-back-state")).toHaveText("workouts:0");
  expect(await page.evaluate(() => window.__backStats())).toEqual({ show: 0, hide: 0, onClick: 0, offClick: 0, handlers: 0, visible: false });
  await page.evaluate(() => { window.__installTelegramBack(); window.dispatchEvent(new Event("telegram-mini-app-ready")); });
  await expect.poll(() => page.evaluate(() => window.__backStats())).toEqual({ show: 1, hide: 0, onClick: 1, offClick: 0, handlers: 1, visible: true });
  await page.getByRole("button", { name: "Обновить таймер", exact: true }).click();
  await page.evaluate(() => { window.dispatchEvent(new Event("telegram-mini-app-ready")); window.dispatchEvent(new Event("telegram-mini-app-ready")); });
  expect(await page.evaluate(() => window.__backStats())).toEqual({ show: 1, hide: 0, onClick: 1, offClick: 0, handlers: 1, visible: true });
  await page.evaluate(() => window.__telegramBack());
  await expect(page.getByTestId("stable-back-result")).toHaveText("workouts:1");
  await page.getByRole("button", { name: "Размонтировать экран", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__backStats())).toMatchObject({ show: 1, onClick: 1, offClick: 1, handlers: 0, visible: false });
  expect((await page.evaluate(() => window.__backStats())).hide).toBeGreaterThan(0);
  assertNoErrors();
});

test("workout plan keeps five primary tabs and local plan/history navigation", async ({ page }) => {
  test.setTimeout(60_000);
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=workoutPlan&clientHarnessTheme=warm-light");
  const mainNav = page.getByRole("navigation", { name: "Основные разделы" });
  await expect(mainNav).toBeVisible({ timeout: 40_000 });
  await expect(mainNav.getByRole("button")).toHaveCount(5);
  await expect(mainNav.locator('[aria-current="page"]')).toHaveText("Тренировки");
  const sectionNav = page.getByRole("navigation", { name: "Раздел тренировок" });
  await expect(sectionNav.locator('[aria-current="page"]')).toHaveText("План");
  await mkdir("artifacts/variant-a-preview", { recursive: true });
  await page.screenshot({ path: "artifacts/variant-a-preview/workout-plan-402.png" });
  await sectionNav.getByRole("button", { name: "История", exact: true }).click();
  await expect(page.getByTestId("workout-history-page")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Раздел тренировок" }).locator('[aria-current="page"]')).toHaveText("История");
  await mainNav.getByRole("button", { name: "Питание", exact: true }).click();
  await expect(page.getByTestId("client-harness-nutrition")).toBeVisible();
  assertNoErrors();
});

test("set editor keeps Done visible with three wheel rows on low landscape screens", async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=workoutRunStage&clientWorkoutRunStage=exercise&clientHarnessTheme=warm-light");
  // The fixture can advance past completed sets; edit the current visible set.
  await page.getByRole("button", { name: /^Изменить подход \d+$/ }).click();
  const dialog = page.getByTestId("workout-set-edit-modal");
  const done = dialog.getByRole("button", { name: "Готово", exact: true });
  await expect(done).toBeInViewport({ ratio: 1 });
  const picker = dialog.getByRole("listbox").first();
  const metrics = await picker.evaluate(node => ({ height: node.clientHeight, row: node.querySelector('[role="option"]').getBoundingClientRect().height }));
  expect(Math.abs(metrics.height - metrics.row * 3)).toBeLessThanOrEqual(1);
  await mkdir("artifacts/variant-a-preview", { recursive: true });
  await page.screenshot({ path: "artifacts/variant-a-preview/set-editor-844x390.png" });
  await done.click();
  await expect(dialog).toHaveCount(0);
  assertNoErrors();
});
