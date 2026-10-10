import { expect, test } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

for (const viewport of [{ width: 402, height: 874 }, { width: 320, height: 720 }]) {
  test(`calendar edit actions replace the edit button at ${viewport.width}px`, async ({ page }, testInfo) => {
    const assertNoErrors = failOnRuntimeErrors(page);
    await page.setViewportSize(viewport);
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      return ["localhost", "127.0.0.1"].includes(url.hostname) ? route.continue() : route.abort();
    });
    await page.goto("/?clientHarness=1&clientCabinetModal=calendar&clientHarnessTheme=warm-light");
    await page.getByTestId("client-nav-cabinet").click();
    const calendar = page.getByTestId("profile-workout-calendar");
    const edit = calendar.getByRole("button", { name: "Изменить расписание" });
    const actions = calendar.getByTestId("profile-workout-calendar-edit-actions");
    await expect(edit).toBeVisible();
    const initialBounds = await edit.boundingBox();
    await edit.click();
    await expect(edit).toHaveCount(0);
    await expect(actions).toHaveCount(1);
    await expect(actions).toBeVisible();
    const actionBounds = await actions.boundingBox();
    expect(Math.abs(actionBounds.x - initialBounds.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(actionBounds.y - initialBounds.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(actionBounds.width - initialBounds.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(actionBounds.height - initialBounds.height)).toBeLessThanOrEqual(1);
    const firstDayBounds = await calendar.getByTestId("profile-workout-calendar-day").first().boundingBox();
    expect(actionBounds.y + actionBounds.height).toBeLessThan(firstDayBounds.y);
    for (const name of ["Отмена", "Сохранить"]) {
      const button = actions.getByRole("button", { name, exact: true });
      await expect(button).toBeEnabled();
      expect(await button.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width >= 44 && rect.height >= 44 && rect.left >= 0 && rect.right <= innerWidth
          && node.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
      })).toBe(true);
    }
    await page.screenshot({ path: testInfo.outputPath(`calendar-actions-${viewport.width}.png`) });
    await actions.getByRole("button", { name: "Отмена", exact: true }).click();
    await expect(edit).toBeVisible();
    await expect(actions).toHaveCount(0);
    await edit.click();
    await actions.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(edit).toBeVisible();
    await expect(actions).toHaveCount(0);
    assertNoErrors();
  });
}
