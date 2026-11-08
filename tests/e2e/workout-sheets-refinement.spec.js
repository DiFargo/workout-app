import { test, expect } from "./app-test.js";

async function openSheet(page, sheet, extra = "") {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/?clientHarness=1&clientHarnessPage=workoutSheets&sheet=${sheet}${extra}`);
  const id = sheet === "feedback" ? "profile-feedback-dialog" : sheet === "mode" ? "workout-mode-dialog" : "profile-workout-journal-dialog";
  const dialog = page.getByTestId(id);
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  return dialog;
}
for (const sheet of ["calendar", "history", "mode", "feedback"]) {
  test(`${sheet} has a readable mobile sheet`, async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    for (const viewport of [{ width: 375, height: 667 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      const dialog = await openSheet(page, sheet);
      const box = await dialog.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
      expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      if (viewport.width === 375) await page.screenshot({ path: testInfo.outputPath(`${sheet}-375.png`), scale: "css" });
      const controls = dialog.locator('button:visible, input:visible:not([type="file"]):not([type="checkbox"]), textarea:visible');
      for (const control of await controls.all()) {
        await control.scrollIntoViewIfNeeded();
        const bounds = await control.boundingBox();
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
      }
      if (sheet === "feedback") {
        const submit = await dialog.getByRole("button", { name: "Отправить", exact: true }).boundingBox();
        expect(submit.y + submit.height).toBeLessThanOrEqual(viewport.height);
      }
    }
  });
}
test("calendar month controls remain reachable after scrolling on a small phone", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const dialog = await openSheet(page, "calendar");
  const panel = dialog.getByRole("tabpanel", { name: "Календарь тренировок", exact: true });
  await panel.evaluate(el => { el.parentElement.scrollTop = el.parentElement.scrollHeight; });
  for (const name of ["Предыдущий месяц", "Следующий месяц"]) {
    const control = dialog.getByRole("button", { name, exact: true });
    expect(await control.evaluate(el => {
      const r = el.getBoundingClientRect();
      return r.height >= 44 && r.width >= 44 && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    })).toBe(true);
  }
  await dialog.getByRole("button", { name: "Следующий месяц", exact: true }).click();
  await expect(dialog).toContainText("октябрь 2026");
  await dialog.getByRole("button", { name: "Предыдущий месяц", exact: true }).click();
  await expect(dialog).toContainText("сентябрь 2026");
  await dialog.screenshot({ path: testInfo.outputPath("calendar-sticky-month-navigation.png") });
});

test("calendar keeps month navigation, date editing, cancel and save", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const dialog = await openSheet(page, "calendar");
  await dialog.getByLabel("Следующий месяц", { exact: true }).click();
  await expect(dialog).toContainText("октябрь 2026");
  await dialog.getByLabel("Предыдущий месяц", { exact: true }).click();
  await page.getByTestId("profile-workout-calendar-edit").click();
  await dialog.getByRole("button", { name: "08.09.2026", exact: true }).click();
  await dialog.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(page.getByTestId("profile-workout-calendar-edit-actions")).toHaveCount(0);
  await page.getByTestId("profile-workout-calendar-edit").click();
  await dialog.getByRole("button", { name: "08.09.2026", exact: true }).click();
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByTestId("workout-sheets-result")).toContainText("2026-09-08");
  await expect(dialog.getByRole("status")).toHaveText("Расписание сохранено");
});
test("history expands full names and saved sets, and retains delete request", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const dialog = await openSheet(page, "history");
  const rows = page.getByTestId("profile-workout-history-toggle");
  await expect(rows).toHaveCount(8);
  expect(await rows.nth(1).locator("strong").evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await rows.first().click();
  await expect(dialog).toContainText("Самочувствие: Хорошо");
  await expect(dialog).toContainText("12 повт.");
  await expect(dialog).toContainText("20 кг");
  await page.getByTestId("profile-workout-history-delete").click();
  await expect(page.getByTestId("workout-sheets-result")).toHaveText("delete-request:history-0");
  await rows.first().click();
  await expect(rows.first()).toHaveAttribute("aria-expanded", "false");
  await dialog.getByRole("tab", { name: "Календарь", exact: true }).click();
  await expect(page.getByTestId("profile-workout-calendar")).toBeVisible();
});
test("mode selection preserves remember choice and selected indication", async ({ page }) => {
  const dialog = await openSheet(page, "mode");
  const remember = dialog.getByRole("checkbox");
  await remember.uncheck();
  await page.getByTestId("workout-mode-option").first().click();
  await expect(page.getByTestId("workout-sheets-result")).toHaveText("basic:false");
  await expect(page.getByTestId("workout-mode-option").first()).toHaveAttribute("aria-pressed", "true");
  await remember.check();
  await page.getByTestId("workout-mode-option").last().click();
  await expect(page.getByTestId("workout-sheets-result")).toHaveText("individual:true");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
test("feedback retains attachment, validation, retry and completion", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const dialog = await openSheet(page, "feedback", "&failFirst=1");
  const submit = dialog.getByRole("button", { name: "Отправить", exact: true });
  const types = await page.getByTestId("profile-feedback-type").all();
  const rows = await Promise.all(types.map(async type => Math.round((await type.boundingBox()).y)));
  expect(new Set(rows).size).toBe(1);
  const fileBox = await dialog.locator('label').filter({ hasText: "Прикрепить файлы" }).boundingBox();
  const textBox = await dialog.locator('textarea').boundingBox();
  expect(fileBox.y).toBeLessThan(textBox.y);
  await expect(dialog).toContainText("администратор приложения");
  await expect(submit).toBeDisabled();
  await page.getByTestId("profile-feedback-type").nth(2).click();
  const selected = page.getByTestId("profile-feedback-type").nth(2);
  await expect(selected).toHaveAttribute("aria-pressed", "true");
  expect(await selected.evaluate(node => getComputedStyle(node).backgroundImage)).toContain("linear-gradient");
  await expect(selected).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.getByTestId("profile-feedback-type").first()).toHaveAttribute("aria-pressed", "false");
  await dialog.locator("textarea").fill("Добавьте удобный просмотр результатов тренировки.");
  await dialog.locator('input[type="file"]').setInputFiles({ name: "feedback-example.txt", mimeType: "text/plain", buffer: Buffer.from("Example") });
  await expect(dialog).toContainText("feedback-example.txt");
  await dialog.getByRole("button", { name: "Убрать вложение feedback-example.txt", exact: true }).click();
  await expect(dialog.getByText("feedback-example.txt", { exact: true })).toHaveCount(0);
  await dialog.locator('input[type="file"]').setInputFiles([{ name: "feedback-example.txt", mimeType: "text/plain", buffer: Buffer.from("Example") }, {name:"second.log",mimeType:"text/plain",buffer:Buffer.from("log")}]);
  await submit.click();
  await expect(dialog.getByRole("status")).toContainText("Не получилось отправить");
  await submit.click();
  await expect(page.getByTestId("workout-sheets-result")).toContainText('"type":"idea"');
  await expect(page.getByTestId("workout-sheets-result")).toContainText('"files":["feedback-example.txt","second.log"]');
  await expect(dialog).toHaveCount(0);
});

// This file owns its viewport matrix; avoid repeating it in the second project.
test.beforeEach(() => { test.skip(test.info().project.name !== "mobile-chromium", "Viewport matrix runs once"); });
