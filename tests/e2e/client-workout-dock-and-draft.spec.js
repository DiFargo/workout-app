import { expect, test } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(90_000);

async function openWorkoutHarness(page, url, ready) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  // Dialogs render in a portal, so their empty harness main has no visible box.
  await expect(page.getByTestId(ready)).toBeAttached({ timeout: 40_000 });
}

test("warmup dock contains both buttons at phone and landscape widths", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  for (const viewport of [{ width: 320, height: 720 }, { width: 375, height: 812 }, { width: 427, height: 898 }, { width: 812, height: 375 }]) {
    await page.setViewportSize(viewport);
    await openWorkoutHarness(page, "/?clientHarness=1&clientHarnessPage=workoutRunStage&clientWorkoutRunStage=warmup&clientHarnessTheme=warm-light", "client-harness-workout-run-stage");
    const panel = page.locator('[data-css-module-scope="workout-stage-action-panel"]');
    await expect(panel.getByRole("button", { name: "Начать тренировку", exact: true })).toBeVisible();
    const geometry = await panel.evaluate((element) => {
      const rect = (node) => {
        const { left, right, top, bottom, width, height } = node.getBoundingClientRect();
        return { left, right, top, bottom, width, height };
      };
      return {
        panel: rect(element), row: rect(element.lastElementChild),
        buttons: [...element.lastElementChild.querySelectorAll("button")].map(rect),
        viewport: { width: innerWidth, height: innerHeight }, documentWidth: document.documentElement.scrollWidth
      };
    });
    expect(geometry.panel.left).toBeGreaterThanOrEqual(0);
    expect(geometry.panel.right).toBeLessThanOrEqual(viewport.width + 1);
    expect(geometry.panel.bottom).toBeLessThanOrEqual(viewport.height + 1);
    expect(geometry.documentWidth).toBeLessThanOrEqual(viewport.width + 1);
    for (const button of geometry.buttons) {
      expect(button.width).toBeGreaterThanOrEqual(44);
      expect(button.height).toBeGreaterThanOrEqual(44);
      expect(button.left).toBeGreaterThanOrEqual(geometry.row.left + 4);
      expect(button.right).toBeLessThanOrEqual(geometry.row.right - 4);
      expect(button.top).toBeGreaterThanOrEqual(geometry.row.top + 4);
      expect(button.bottom).toBeLessThanOrEqual(geometry.row.bottom - 4);
      expect(button.bottom).toBeLessThanOrEqual(geometry.panel.bottom);
    }
    await testInfo.attach(`warmup-${viewport.width}.png`, { body: await page.screenshot(), contentType: "image/png" });
  }
  assertNoRuntimeErrors();
});

test("draft sheet fills phone width and can be cancelled by close, Escape or backdrop", async ({ page }, testInfo) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const url = "/?clientHarness=1&clientHarnessPage=workoutDialogs&clientWorkoutDialog=draft&clientHarnessTheme=warm-light";
  for (const width of [320, 375, 427, 812]) {
    await page.setViewportSize({ width, height: width === 812 ? 375 : 898 });
    await openWorkoutHarness(page, url, "client-harness-workout-dialogs");
    const dialog = page.getByRole("dialog", { name: "Продолжить тренировку?", exact: true });
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds.width).toBeCloseTo(Math.min(width, 520), 0);
    const close = dialog.getByRole("button", { name: "Закрыть окно восстановления тренировки" });
    await expect(close).toBeVisible();
    const closeBounds = await close.boundingBox();
    expect(closeBounds.width).toBeGreaterThanOrEqual(44);
    expect(closeBounds.height).toBeGreaterThanOrEqual(44);
    await testInfo.attach(`draft-${width}.png`, { body: await page.screenshot(), contentType: "image/png" });
    await close.click();
    await expect(page.getByTestId("workout-draft-restore-dialog")).toHaveCount(0);
    await expect(page.getByTestId("client-harness-workouts")).toBeVisible();
  }
  await page.setViewportSize({ width: 427, height: 898 });
  for (const method of ["escape", "backdrop"]) {
    await openWorkoutHarness(page, url, "client-harness-workout-dialogs");
    await expect(page.getByTestId("workout-draft-restore-dialog")).toBeVisible();
    if (method === "escape") await page.keyboard.press("Escape");
    else await page.getByTestId("workout-draft-restore-dialog").click({ position: { x: 5, y: 5 } });
    await expect(page.getByTestId("workout-draft-restore-dialog")).toHaveCount(0);
  }
  assertNoRuntimeErrors();
});
