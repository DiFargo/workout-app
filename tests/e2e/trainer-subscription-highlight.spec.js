import { expect, test } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(60_000);

async function openClient(page) {
  await page.clock.install({ time: new Date("2026-06-01T12:00:00.000Z") });
  await page.goto("/?trainerHarness=1&scheduleReady=1&programAssignments=1");
  await expect(page.locator(".trainerNextRoot")).toBeVisible({ timeout: 40_000 });
  const mobile = page.getByTestId("trainer-nav-clients");
  await (await mobile.isVisible() ? mobile : page.getByTestId("trainer-desktop-nav-clients")).click();
  await page.locator(".trainerNextClientTable > button").first().click();
  await expect(page.locator(".trainerNextClientPage")).toBeVisible();
}

async function clientTab(page, name) {
  const desktop = page.locator(".trainerNextClientTabs").getByRole("button", { name, exact: true });
  await (await desktop.isVisible() ? desktop : page.locator(".trainerNextClientMobileNav").getByRole("button", { name, exact: true })).click();
}

async function closeSheet(dialog) {
  await dialog.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function inspectHighlight(page, dialog, testInfo, name) {
  const calendar = dialog.getByTestId("trainer-subscription-calendar");
  await calendar.getByRole("button", { name: "Календарь", exact: true }).click();
  const plainRangeDay = calendar.locator('button[data-date="2026-06-16"]');
  await expect(plainRangeDay).toHaveAttribute("data-subscription-range", "true");
  await expect(calendar.locator('button[data-date="2026-06-15"]')).toHaveAttribute("data-range-start", "true");
  const visual = await plainRangeDay.evaluate((button) => {
    const css = getComputedStyle(button);
    const after = getComputedStyle(button, "::after");
    return {
      background: css.backgroundColor,
      shadow: css.boxShadow,
      outlineStyle: css.outlineStyle,
      outlineWidth: css.outlineWidth,
      outlineColor: css.outlineColor,
      overlay: after.content,
      columnGap: getComputedStyle(button.parentElement).columnGap
    };
  });
  expect(visual.background).toBe("rgb(237, 243, 251)");
  const boundaryShadow = await calendar.locator('button[data-date="2026-06-15"]').evaluate(button => getComputedStyle(button).boxShadow);
  expect(boundaryShadow).toMatch(/inset/);
  expect(boundaryShadow).toMatch(/-2px/);
  const hasVisibleOutline = visual.outlineStyle !== "none" &&
    Number.parseFloat(visual.outlineWidth) > 0 && visual.outlineColor !== "rgba(0, 0, 0, 0)";
  expect(hasVisibleOutline, JSON.stringify(visual)).toBe(false);
  expect(["none", "normal"]).toContain(visual.overlay);
  expect(Number.parseFloat(visual.columnGap)).toBeGreaterThanOrEqual(1);

  const completed = calendar.locator('button[data-date="2026-06-15"]');
  await expect(completed).toHaveAttribute("aria-label", /Выполнена/);
  await expect(completed.locator('[data-event-status="completed"]').first()).toBeVisible();
  const outside = calendar.locator('button[data-date="2026-06-14"]');
  await expect(outside).not.toHaveAttribute("data-subscription-range", "true");
  expect(await outside.evaluate((button) => getComputedStyle(button).backgroundColor)).not.toBe(visual.background);
  await plainRangeDay.scrollIntoViewIfNeeded();
  expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`soft-range-${name}.png`), scale: "css" });

  await calendar.getByRole("button", { name: "Следующий месяц", exact: true }).click();
  await expect(calendar.locator('button[data-date="2026-07-20"]')).toHaveAttribute("data-range-end", "true");
  await expect(calendar.locator('button[data-date="2026-07-21"]')).not.toHaveAttribute("data-subscription-range", "true");
}

async function inspectBothCalendars(page, testInfo, suffix) {
  await page.getByRole("button", { name: "Открыть абонемент", exact: true }).click();
  const overviewCalendar = page.getByRole("dialog", { name: "Календарь тренировок", exact: true });
  await expect(overviewCalendar).toBeVisible();
  await inspectHighlight(page, overviewCalendar, testInfo, `overview-${suffix}`);
  await closeSheet(overviewCalendar);

  await clientTab(page, "Тренировки");
  const scheduleEntry = page.getByText("Расписание и абонемент", { exact: true });
  await expect(scheduleEntry).toBeVisible();
  await scheduleEntry.locator("..").getByRole("button", { name: "Редактировать", exact: true }).click();
  const workoutsCalendar = page.getByRole("dialog", { name: "Расписание и абонемент", exact: true });
  await expect(workoutsCalendar).toBeVisible();
  await inspectHighlight(page, workoutsCalendar, testInfo, `workouts-${suffix}`);
  await closeSheet(workoutsCalendar);
}

test("overview keeps tasks and messages without its duplicate calendar row; both calendars use soft date tiles", async ({ page }, testInfo) => {
  if (testInfo.project.name.startsWith("mobile")) await page.setViewportSize({ width: 402, height: 874 });
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await openClient(page);
  await clientTab(page, "Сводка");
  await expect(page.getByText("Расписание и абонемент", { exact: true })).toHaveCount(0);
  const tasks = page.getByRole("button", { name: "Задания клиенту Текущие задания и результаты", exact: true });
  const messages = page.getByRole("button", { name: "Сообщения Переписка с клиентом", exact: true });
  await expect(tasks).toBeVisible();
  await expect(messages).toBeVisible();
  await tasks.click();
  const tasksSheet = page.getByRole("dialog", { name: "Задания клиенту", exact: true });
  await expect(tasksSheet).toBeVisible();
  await closeSheet(tasksSheet);
  await messages.click();
  const messagesSheet = page.getByRole("dialog", { name: "Сообщения", exact: true });
  await expect(messagesSheet).toBeVisible();
  await closeSheet(messagesSheet);
  await expect(page.getByRole("button", { name: "Открыть абонемент", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("overview-actions.png"), scale: "css" });
  await inspectBothCalendars(page, testInfo, "primary");
  assertNoRuntimeErrors();
});

test("soft highlighting and the workouts calendar entry remain available at 320px", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Compact representative runs once per browser");
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await openClient(page);
  await clientTab(page, "Сводка");
  await expect(page.getByText("Расписание и абонемент", { exact: true })).toHaveCount(0);
  await inspectBothCalendars(page, testInfo, "320");
  assertNoRuntimeErrors();
});
