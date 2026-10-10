import { expect, test } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

for (const width of [402, 320]) {
  test(`calendar matches legend and explains selected status at ${width}`, async ({ page }, testInfo) => {
    const assertNoErrors = failOnRuntimeErrors(page);
    await page.setViewportSize({ width, height: 874 });
    await page.route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
    await page.goto("/?clientHarness=1&clientCabinetModal=calendar&clientHarnessTheme=warm-light");
    await page.getByTestId("client-nav-cabinet").click();
    const calendar = page.getByTestId("profile-workout-calendar");
    const cases = [
      ["2026-06-23", "planned", "Тренировка запланирована"],
      ["2026-06-05", "completed", "Выполнена в запланированный день"],
      ["2026-06-09", "completed_off_date", "Выполнена не в запланированный день"],
      ["2026-06-12", "missed", "Плановая дата прошла, выполнение не отмечено"],
      ["2026-06-19", "shifted", "Предложенная дата переноса"],
      ["2026-06-22", "historyCompleted", "Выполненная тренировка из истории"]
    ];
    const colors = [];
    for (const [date, status, description] of cases) {
      const day = calendar.locator(`[data-date="${date}"]`);
      await expect(day).toHaveAttribute("data-status", status);
      const mark = day.locator("i").first();
      const legend = calendar.locator(`[data-calendar-legend="${status}"] i`);
      const color = await mark.evaluate(node => getComputedStyle(node).color);
      expect(color).toEqual(await legend.evaluate(node => getComputedStyle(node).color));
      colors.push(color);
      await expect(day).toHaveAccessibleName(new RegExp(description));
      await day.click();
      await expect(calendar.getByTestId("profile-workout-calendar-selected-status")).toContainText(description);
    }
    expect(new Set(colors).size).toBe(6);
    await calendar.getByRole("button", { name: "Изменить расписание" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`calendar-legend-${width}.png`) });
    expect(await calendar.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    assertNoErrors();
  });
}
