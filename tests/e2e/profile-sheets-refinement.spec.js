import { test, expect } from "@playwright/test";

async function openSheet(page, sheet, extra = "") {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/?clientHarness=1&clientHarnessPage=profileSheets&clientHarnessTheme=warm-light&sheet=${sheet}${extra}`);
  const dialog = page.getByTestId(sheet === "nutrition" ? "profile-nutrition-dialog" : "profile-settings-dialog");
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  return dialog;
}

for (const sheet of ["profile", "nutrition", "settings", "connections"]) {
  test(`${sheet} sheet fits mobile sizes with readable controls`, async ({ page }, testInfo) => {
    for (const viewport of [{ width: 375, height: 667 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      const dialog = await openSheet(page, sheet);
      const box = await dialog.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
      expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      const close = dialog.locator('[data-profile-modal-close="true"]');
      const closeBox = await close.boundingBox();
      expect(closeBox.height).toBeGreaterThanOrEqual(44);
      expect(closeBox.y + closeBox.height).toBeLessThanOrEqual(viewport.height);
      const controls = dialog.locator("button:visible, input:visible, select:visible");
      for (const control of await controls.all()) {
        await control.scrollIntoViewIfNeeded();
        const bounds = await control.boundingBox();
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
      }
      await dialog.locator("h1").scrollIntoViewIfNeeded();
      if (viewport.width === 375) {
        await dialog.evaluate(node => node.querySelectorAll("*").forEach(child => { if (child.scrollHeight > child.clientHeight) child.scrollTop = 0; }));
        await page.screenshot({ path: testInfo.outputPath(`${sheet}-375.png`) });
      }
      await close.click();
      await expect(dialog).toHaveCount(0);
    }
  });
}

test("body parameters retain validation, editing, error and save feedback", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openSheet(page, "profile", "&failFirst=1");
  await page.getByLabel("Текущий вес", { exact: true }).fill("");
  const save = page.getByTestId("profile-body-metrics-save");
  await expect(save).toBeDisabled();
  await page.getByLabel("Текущий вес", { exact: true }).fill("83.5");
  await page.getByLabel("Активность", { exact: true }).selectOption("veryHigh");
  await page.getByLabel("Твоя цель", { exact: true }).selectOption("maintain");
  await page.getByRole("button", { name: "Мужчина", exact: true }).click();
  await save.click();
  await expect(page.getByRole("alert")).toContainText("Не удалось сохранить");
  await save.click();
  await expect(page.getByTestId("profile-sheets-result")).toContainText('"weight":"83.5"');
  await expect(page.getByTestId("profile-sheets-result")).toContainText('"activity":"veryHigh"');
  await expect(page.getByText("Анкета сохранена", { exact: true })).toBeVisible();
});

test("nutrition goals, all macros, calendar navigation and save remain functional", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const dialog = await openSheet(page, "nutrition", "&failFirst=1");
  await expect(dialog.getByText("Белки", { exact: true })).toBeVisible();
  const selected = dialog.getByRole("button", { name: "Выбрать цель питания: Набор", exact: true });
  await selected.click();
  await expect(selected).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.locator('[aria-pressed="true"]')).toHaveCount(1);
  await page.getByTestId("profile-nutrition-next-week").click();
  await expect(dialog.getByText("14–20 сентября", { exact: true })).toBeVisible();
  await page.getByTestId("profile-nutrition-previous-week").click();
  await expect(dialog.getByText("7–13 сентября", { exact: true })).toBeVisible();
  const save = page.getByTestId("profile-nutrition-save");
  await save.click();
  await expect(save).toHaveText("Повторить сохранение");
  await save.click();
  await expect(page.getByTestId("profile-sheets-result")).toContainText('"goal":"mass"');
  await expect(save).toHaveAttribute("data-save-state", "saved");
});

test("notification preferences save with pending state, failure and retry", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const dialog = await openSheet(page, "settings", "&failFirst=1");
  await expect(dialog.getByRole("heading", { name: "Уведомления", exact: true })).toBeVisible();
  await expect(dialog.getByTestId("profile-settings-email")).toHaveCount(0);
  await expect(dialog.getByTestId("profile-settings-telegram")).toHaveCount(0);
  const toggle = page.getByTestId("profile-settings-notifications-toggle");
  await toggle.click();
  await expect(toggle).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("Не удалось сохранить");
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(dialog.getByRole("status")).toHaveText("Напоминания отключены");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(dialog.getByRole("status")).toHaveText("Напоминания включены");
});

test("account connections contain only linked accounts with working actions", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const dialog = await openSheet(page, "connections");
  await expect(dialog.getByRole("heading", { name: "Подключение аккаунтов" })).toBeVisible();
  await expect(dialog.getByTestId("profile-settings-notifications-toggle")).toHaveCount(0);
  expect(await dialog.locator("small").evaluateAll(nodes => nodes.every(node => node.scrollWidth <= node.clientWidth + 1))).toBe(true);
  await page.getByTestId("profile-settings-email").click();
  await expect(page.getByTestId("profile-sheets-result")).toHaveText("email");
  await page.getByTestId("profile-settings-telegram").click();
  await expect(page.getByTestId("profile-sheets-result")).toHaveText("telegram");
});

test("disconnected Telegram cannot enable reminders and offers the connection section", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const dialog = await openSheet(page, "settings", "&clientTelegramState=disconnected");
  const toggle = dialog.getByRole("switch", { name: "Напоминания в Telegram" });
  await expect(toggle).toBeDisabled();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(dialog.getByText("Telegram не подключён", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Перейти к подключению аккаунтов" }).click();
  await expect(dialog).toHaveAttribute("data-profile-settings-section", "connections");
  await expect(dialog.getByTestId("profile-settings-telegram")).toContainText("Нажми, чтобы подключить");
});
