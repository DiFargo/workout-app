import { test, expect } from "./app-test.js";

test.beforeEach(async ({ page }) => {
  test.skip(test.info().project.name !== "mobile-chromium", "Own viewport matrix");
  await page.setViewportSize({ width: 402, height: 874 });
  await page.emulateMedia({ reducedMotion: "reduce" });
});
async function open(page, extra = "") {
  await page.goto(`/?clientHarness=1&clientHarnessPage=profileSheets&clientHarnessTheme=warm-light&sheet=settings${extra}`);
  const dialog = page.getByTestId("profile-settings-dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}
async function saved(page) {
  await expect(page.getByTestId("profile-settings-dialog").getByRole("status")).toHaveText("Настройки сохранены");
}

test("independent workout, photo, measurement preferences persist and test delivery is explicit", async ({ page }, info) => {
  const dialog = await open(page);
  await page.screenshot({ path: info.outputPath("notifications-iphone17pro.png") });
  const offsets = dialog.getByRole("group", { name: "Когда напоминать о тренировке" });
  await offsets.getByRole("button", { name: "3 ч", exact: true }).click();
  await saved(page);
  await expect(offsets.getByRole("button", { name: "24 ч", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(offsets.getByRole("button", { name: "3 ч", exact: true })).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("switch", { name: "Фото прогресса", exact: true }).click();
  await saved(page);
  await dialog.getByRole("group", { name: "Период фото прогресса" }).getByRole("button", { name: "7 дней", exact: true }).click();
  await saved(page);
  await dialog.getByRole("switch", { name: "Замеры тела", exact: true }).click();
  await saved(page);
  await dialog.getByRole("group", { name: "Период замеров тела" }).getByRole("button", { name: "30 дней" }).click();
  await saved(page);
  const time = dialog.getByLabel("Время для фото и замеров");
  await time.fill("18:35");
  await time.blur();
  await saved(page);
  await dialog.getByRole("switch", { name: "Тренировки", exact: true }).click();
  await saved(page);
  await expect(dialog.getByRole("switch", { name: "Фото прогресса", exact: true })).toHaveAttribute("aria-checked", "true");
  await expect(dialog.getByRole("switch", { name: "Замеры тела", exact: true })).toHaveAttribute("aria-checked", "true");
  const result = JSON.parse(await page.getByTestId("profile-sheets-result").textContent());
  expect(result.scheduledDates).toEqual(["2026-09-18"]);
  expect(result.workoutTime).toBe("18:00");
  expect(result.reminderEnabled).toBe(false);
  expect(result.progressReminderSettings).toMatchObject({ photoEnabled: true, measurementsEnabled: true, photoIntervalDays: 7, measurementsIntervalDays: 30, reminderTime: "18:35" });
  await page.getByTestId("profile-settings-close").click();
  await page.getByRole("button", { name: "Открыть настройки" }).click();
  await expect(dialog.getByRole("switch", { name: "Тренировки", exact: true })).toHaveAttribute("aria-checked", "false");
  await expect(dialog.getByLabel("Время для фото и замеров")).toHaveValue("18:35");
  await dialog.getByRole("button", { name: "Отправить тестовое напоминание" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Тестовое напоминание отправлено в Telegram");
  await expect(page.getByTestId("profile-sheets-result")).toHaveText('{"testSent":true}');
  await dialog.getByRole("switch", { name: "Напоминания в Telegram", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText("Напоминания отключены");
  await expect(dialog.getByRole("switch", { name: "Фото прогресса", exact: true })).toHaveAttribute("aria-checked", "true");
});

test("failed setting rolls back, allows retry and never empties workout offsets", async ({ page }) => {
  const dialog = await open(page, "&failFirst=1");
  const toggle = dialog.getByRole("switch", { name: "Фото прогресса", exact: true });
  await toggle.click();
  await expect(toggle).toBeDisabled();
  await expect(dialog.getByRole("alert")).toContainText("Остались прежние настройки");
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await dialog.getByRole("button", { name: "Повторить сохранение" }).click();
  await saved(page);
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await dialog.getByRole("group", { name: "Когда напоминать о тренировке" }).getByRole("button", { name: "24 ч" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Оставьте хотя бы одно время напоминания.");
  await expect(dialog.getByRole("button", { name: "24 ч" })).toHaveAttribute("aria-pressed", "true");
});

test("clicking a reminder switch while time blur saves preserves both preferences", async ({ page }) => {
  const dialog = await open(page);
  await dialog.getByRole("switch", { name: "Фото прогресса", exact: true }).click();
  await saved(page);
  const time = dialog.getByLabel("Время для фото и замеров");
  await time.fill("18:35");
  await time.focus();
  const workouts = dialog.getByRole("switch", { name: "Тренировки", exact: true });
  await workouts.click();
  await expect(workouts).toHaveAttribute("aria-checked", "false");
  await saved(page);
  await expect.poll(async () => JSON.parse(await page.getByTestId("profile-sheets-result").textContent()))
    .toMatchObject({ reminderEnabled: false, progressReminderTime: "18:35", progressPhotoReminderEnabled: true });
  await page.getByTestId("profile-settings-close").click();
  await page.getByRole("button", { name: "Открыть настройки" }).click();
  await expect(workouts).toHaveAttribute("aria-checked", "false");
  await expect(dialog.getByLabel("Время для фото и замеров")).toHaveValue("18:35");
});

test("queued offset clicks retain every change while time saves", async ({ page }) => {
  const dialog = await open(page);
  await dialog.getByRole("switch", { name: "Фото прогресса", exact: true }).click();
  await saved(page);
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  const time = dialog.getByLabel("Время для фото и замеров");
  await time.fill("18:35");
  await time.focus();
  const offsets = dialog.getByRole("group", { name: "Когда напоминать о тренировке" });
  await offsets.getByRole("button", { name: "1 ч", exact: true }).click();
  await expect(offsets.getByRole("button", { name: "1 ч", exact: true })).toHaveAttribute("aria-pressed", "true");
  await offsets.getByRole("button", { name: "24 ч", exact: true }).click();
  await expect(offsets.getByRole("button", { name: "24 ч", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.clock.runFor(600);
  await saved(page);
  await expect.poll(async () => JSON.parse(await page.getByTestId("profile-sheets-result").textContent()))
    .toMatchObject({ reminderOffsetsHours: [1], progressReminderTime: "18:35" });
  await page.getByTestId("profile-settings-close").click();
  await page.getByRole("button", { name: "Открыть настройки" }).click();
  await expect(offsets.getByRole("button", { name: "1 ч", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(offsets.getByRole("button", { name: "24 ч", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(dialog.getByLabel("Время для фото и замеров")).toHaveValue("18:35");
});

test("expanded settings scroll inside the sheet and all controls remain reachable", async ({ page }, info) => {
  for (const viewport of [{ width: 402, height: 874 }, { width: 320, height: 568 }, { width: 844, height: 390 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    const dialog = await open(page);
    await dialog.getByRole("switch", { name: "Фото прогресса", exact: true }).click();
    await saved(page);
    await dialog.getByRole("switch", { name: "Замеры тела", exact: true }).click();
    await saved(page);
    if (viewport.width === 402) {
      await page.addStyleTag({ content: '[data-testid="profile-notification-settings"] { font-size: 20px; }' });
    }
    const box = await dialog.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    for (const control of await dialog.locator("button:visible, input:visible").all()) {
      await control.scrollIntoViewIfNeeded();
      const rect = await control.boundingBox();
      expect(rect.height).toBeGreaterThanOrEqual(43.5);
      expect(rect.x).toBeGreaterThanOrEqual(box.x);
      expect(rect.x + rect.width).toBeLessThanOrEqual(box.x + box.width + 1);
    }
    await page.screenshot({ path: info.outputPath(`notifications-expanded-${viewport.width}.png`) });
    await page.getByTestId("profile-settings-close").click();
    await expect(dialog).toHaveCount(0);
  }
});

test("disconnected users cannot save or send and have a connection path", async ({ page }) => {
  const dialog = await open(page, "&clientTelegramState=disconnected");
  for (const toggle of await dialog.getByRole("switch").all()) await expect(toggle).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Отправить тестовое напоминание" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Перейти к подключению аккаунтов" }).click();
  await expect(dialog).toHaveAttribute("data-profile-settings-section", "connections");
});
