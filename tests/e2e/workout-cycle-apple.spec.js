import { test, expect } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(90_000);
const runUrl = "/cssV2?clientHarness=1&clientHarnessPage=workoutRunStage";

async function capture(page, testInfo, name) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), scale: "css" });
}

for (const viewport of [{ width: 320, height: 568 }, { width: 393, height: 852 }, { width: 844, height: 390 }, { width: 1366, height: 900 }]) {
  test(`approved workout cycle at ${viewport.width}`, async ({ page }, testInfo) => {
    const assertNoErrors = failOnRuntimeErrors(page);
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    // Control elapsed time so screenshots cannot race the countdown assertions.
    await page.clock.install({ time: new Date("2026-10-08T10:00:00Z") });
    await page.goto(runUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const rows = page.getByTestId("workout-exercise-set-row");
    await expect(rows).toHaveCount(1, { timeout: 40_000 });
    await capture(page, testInfo, "exercise");
    const row = rows.first();
    await row.scrollIntoViewIfNeeded();
    // In landscape, finish scrolling the content region above the fixed dock.
    await page.getByTestId("workout-run-stage").evaluate(el => { el.scrollTop = el.scrollHeight; });
    const edit = row.getByRole("button", { name: "Изменить подход 2" });
    const complete = page.getByTestId("workout-primary-action");
    await expect(complete).toHaveAccessibleName("Подход выполнен");
    const a = await edit.boundingBox(), b = await complete.boundingBox();
    expect(a.width).toBe(48); expect(a.height).toBe(48);
    expect(b.width).toBeGreaterThanOrEqual(48); expect(b.height).toBeGreaterThanOrEqual(48);
    expect(a.y + a.height).toBeLessThan(b.y);
    await capture(page, testInfo, "sets");
    await edit.click();
    const editor = page.getByTestId("workout-set-edit-modal");
    await expect(editor).toBeVisible();
    await capture(page, testInfo, "editor");
    await editor.getByRole("button", { name: "Готово", exact: true }).click();
    await expect(row.getByRole("button", { name: "Подход 2 выполнен, действия", exact: true })).toHaveCount(0);
    await complete.click();
    const timer = page.getByTestId("workout-rest-timer-expanded");
    await expect(timer).toBeVisible();
    await page.getByTestId("workout-rest-timer-minimize").click();
    await expect(row).toHaveClass(/completed/);
    const completedButton = row.getByRole("button", { name: "Подход 2 выполнен, действия", exact: true });
    await expect(completedButton).toBeVisible();
    await expect(complete).toHaveAccessibleName("Следующий подход");
    await page.getByRole("button", { name: "Открыть таймер отдыха", exact: true }).click();
    await expect(timer).toBeVisible();
    // Bootstrap timers must run until the lazy application has mounted.
    await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 100));
    const remaining = await timer.locator("strong").first().innerText();
    const [minutes, seconds] = remaining.split(":").map(Number);
    const baselineSeconds = minutes * 60 + seconds;
    const formatSeconds = value => `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
    const ring = timer.locator('svg[viewBox="0 0 100 100"] circle');
    await expect(ring).toHaveCount(2);
    await capture(page, testInfo, "rest");
    await timer.getByRole("button", { name: "Добавить 15 секунд", exact: true }).click();
    await expect(timer).toContainText(formatSeconds(baselineSeconds + 15));
    await timer.getByRole("button", { name: "Убавить 15 секунд", exact: true }).click();
    await expect(timer).toContainText(formatSeconds(baselineSeconds));
    await page.clock.runFor(1000);
    // The interval phase need not coincide with a whole remaining second.
    // Focus synchronizes the same wall-clock deadline when the user returns.
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(timer).toContainText(formatSeconds(baselineSeconds - 1));
    await page.clock.resume();
    await page.getByTestId("workout-rest-timer-minimize").click();
    await page.getByRole("button", { name: "Открыть раздел «Техника»" }).click();
    const techniqueModal = page.getByTestId("workout-exercise-technique-modal");
    await expect(techniqueModal).toBeVisible();
    await expect(techniqueModal.locator("p")).toContainText("1. Ляг на скамью");
    await expect(techniqueModal.locator("p")).toContainText("2. Опускай штангу");
    await capture(page, testInfo, "technique");
    await page.getByRole("button", { name: "Закрыть пояснение техники" }).click();
    await page.getByRole("button", { name: "Открыть заметку тренеру", exact: true }).click();
    await page.getByTestId("workout-exercise-note-modal").locator("textarea").fill("Проверка заметки");
    await capture(page, testInfo, "note");
    await page.getByRole("button", { name: "Закрыть заметку тренеру" }).click();
    for (const stage of ["warmup", "finish", "saved"]) {
      await page.goto(`${runUrl}&clientWorkoutRunStage=${stage}`);
      await expect(page.getByTestId("workout-run-stage")).toBeVisible();
      await capture(page, testInfo, stage);
      const panel = page.locator('[data-css-module-scope="workout-stage-action-panel"], [data-testid="workout-finish-actions"]').first();
      const bounds = await panel.boundingBox();
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
    }
    for (const dialog of ["readiness", "post", "exit", "incomplete", "draft"]) {
      await page.goto(`/cssV2?clientHarness=1&clientHarnessPage=workoutDialogs&clientWorkoutDialog=${dialog}`);
      await expect(page.getByRole("dialog")).toBeVisible();
      await capture(page, testInfo, dialog);
      if (dialog === "readiness" || dialog === "post") {
        const text = await page.getByRole("dialog").innerText();
        expect(text).toMatch(/\p{Extended_Pictographic}/u);
        const choices = dialog === "readiness"
          ? page.locator('[data-workout-readiness-option]')
          : page.getByRole("dialog").getByRole("button").filter({ has: page.locator("small") });
        for (const choice of await choices.all()) await choice.click({ trial: true });
        if (dialog === "readiness") await page.getByRole("button", { name: "Продолжить", exact: true }).click({ trial: true });
        await capture(page, testInfo, `${dialog}-scrolled`);
      }
    }
    await assertNoErrors();
  });
}

test("warmup through saved result retains controls and entered values", async ({ page }) => {
  await page.goto(`${runUrl}&clientWorkoutRunStage=warmup`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.getByTestId("workout-run-stage")).toBeVisible({ timeout: 40_000 });
  await page.getByRole("button", { name: "Начать тренировку", exact: true }).click();
  await expect(page.getByTestId("workout-exercise-set-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Изменить подход 2" }).click();
  const editor = page.getByTestId("workout-set-edit-modal");
  await editor.getByRole("listbox", { name: "Повторы, подход 2" }).getByRole("option", { name: "12", exact: true }).click();
  await editor.getByRole("button", { name: "Готово", exact: true }).click();
  await expect(page.getByTestId("workout-exercise-set-row")).toContainText("12");
  const next = page.getByTestId("workout-primary-action");
  for (let step = 0; step < 10 && await next.isVisible(); step += 1) {
    // Completing a set opens the real modal timer. Return to the dock before
    // advancing; a background action is deliberately inaccessible to users.
    const timer = page.getByTestId("workout-rest-timer-expanded");
    if (await timer.isVisible()) {
      await page.getByTestId("workout-rest-timer-minimize").click();
      await expect(timer).toBeHidden();
    }
    await next.click();
    // The primary action intentionally debounces completion and progression.
    await page.waitForTimeout(420);
  }
  await expect(page.getByTestId("workout-finish-screen")).toBeVisible();
  await page.getByTestId("workout-finish-screen").locator("textarea").fill("Цикл проверен");
  await page.getByRole("button", { name: "Сохранить и завершить" }).click();
  await expect(page.getByRole("button", { name: "Вернуться в меню" })).toBeVisible();
});

test("basic workout replacement keeps the real set plan", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto(`${runUrl}&clientWorkoutRunMode=basic`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const rows = page.getByTestId("workout-exercise-set-row");
  await expect(rows).toHaveCount(1, { timeout: 40_000 });
  const originalRows = await rows.count();
  await page.getByRole("button", { name: "Другие действия с упражнением", exact: true }).click();
  await page.getByRole("menuitem", { name: "Заменить упражнение", exact: true }).click();
  const sheet = page.getByTestId("basic-workout-exercise-swap-modal");
  await expect(sheet).toBeVisible();
  // A completed approach belongs to the original exercise; first verify the guard.
  await expect(sheet.getByRole("status")).toContainText("уже есть выполненные подходы");
  await expect(sheet.getByTestId("basic-workout-exercise-alternative")).toHaveCount(0);
  await sheet.getByRole("button", { name: "Вернуться к упражнению", exact: true }).click();
  await page.getByRole("button", { name: "Все подходы, выбран подход 2 из 3", exact: true }).click();
  await page.getByRole("button", { name: "Перейти к подходу 1", exact: true }).click();
  const firstComplete = rows.first().getByRole("button", { name: "Подход 1 выполнен, действия", exact: true });
  await firstComplete.click();
  await rows.first().getByRole("button", { name: "Снять отметку выполнения подхода 1", exact: true }).click();
  await expect(firstComplete).toHaveCount(0);
  await expect(page.getByTestId("workout-primary-action")).toHaveAccessibleName("Подход выполнен");
  await page.getByRole("button", { name: "Другие действия с упражнением", exact: true }).click();
  await page.getByRole("menuitem", { name: "Заменить упражнение", exact: true }).click();
  await expect(sheet).toBeVisible();
  await capture(page, testInfo, "replacement");
  const alternative = sheet.getByTestId("basic-workout-exercise-alternative").first();
  await expect(alternative).toBeVisible();
  const name = await alternative.locator("strong").innerText();
  await alternative.click();
  await expect(sheet).toBeHidden();
  await expect(page.locator('[data-css-module-scope="workout-stage-heading"]')).toContainText(name);
  await expect(rows).toHaveCount(originalRows);
  await capture(page, testInfo, "replacement-result");
});
