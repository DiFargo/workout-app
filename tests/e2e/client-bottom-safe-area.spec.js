import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors } from "./runtime-errors.js";

const cases = [
  { name: "iPhone portrait", width: 393, height: 852, bottom: 34 },
  { name: "small iPhone portrait", width: 375, height: 812, bottom: 34 },
  { name: "phone without home inset", width: 421, height: 898, bottom: 0 },
  { name: "iPhone landscape", width: 844, height: 390, bottom: 21 }
];

for (const device of cases) {
  test(`bottom navigation stays compact and clear of the home gesture: ${device.name}`, async ({ page }, testInfo) => {
    const assertNoErrors = failOnRuntimeErrors(page);
    await page.setViewportSize({ width: device.width, height: device.height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const session = await page.context().newCDPSession(page);
    await session.send("Emulation.setSafeAreaInsetsOverride", {
      insets: { top: 0, left: 0, right: 0, bottom: device.bottom }
    });
    await page.goto("/?clientHarness=1&clientHarnessTheme=warm-light&clientWorkoutOverviewState=recovery");

    for (const tab of ["workouts", "nutrition", "progress", "cabinet", "main"]) {
      await page.getByTestId(`client-nav-${tab}`).click();
      const nav = page.getByTestId("client-bottom-nav");
      await expect(page.getByTestId(`client-nav-${tab}`)).toHaveAttribute("aria-current", "page");
      const layout = await nav.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const buttons = Array.from(element.querySelectorAll("button"), (button) => {
          const bounds = button.getBoundingClientRect();
          return { height: bounds.height, bottom: bounds.bottom };
        });
        return {
          height: rect.height,
          bottom: rect.bottom,
          paddingBottom: Number.parseFloat(getComputedStyle(element).paddingBottom),
          viewportHeight: innerHeight,
          overflow: document.documentElement.scrollWidth - innerWidth,
          buttons
        };
      });
      expect(layout.height).toBeLessThanOrEqual(Math.max(70, 56 + device.bottom));
      expect(layout.paddingBottom).toBe(Math.max(12, device.bottom));
      expect(layout.overflow).toBeLessThanOrEqual(1);
      expect(layout.bottom).toBeLessThanOrEqual(layout.viewportHeight);
      for (const button of layout.buttons) {
        expect(button.height).toBeGreaterThanOrEqual(44);
        expect(button.bottom).toBeLessThanOrEqual(layout.bottom - device.bottom);
      }
      if (tab === "workouts") await page.screenshot({ path: testInfo.outputPath("workouts-safe-area.png") });
    }
    assertNoErrors();
  });
}
