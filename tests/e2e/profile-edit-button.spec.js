import { test, expect } from "@playwright/test";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test("profile settings icon stays compact, accessible and opens account editing", async ({ page }, testInfo) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  for (const viewport of [{ width: 320, height: 568 }, { width: 427, height: 898 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/?clientHarness=1&clientHarnessTheme=warm-light");
    await page.getByTestId("client-nav-cabinet").click();
    const button = page.getByRole("button", { name: "Редактировать профиль", exact: true });
    await expect(button).toBeVisible();
    await expect(button).toHaveText("");
    const box = await button.boundingBox();
    expect(box.width).toBe(44);
    expect(box.height).toBe(44);
    expect(box.x + box.width).toBeLessThan(viewport.width);
    expect(await button.evaluate(node => getComputedStyle(node).borderRadius)).toBe("50%");
    await expect(button.locator("svg")).toHaveAttribute("aria-hidden", "true");
    expect((await button.locator("svg").boundingBox()).width).toBe(22);
    if (viewport.width === 427) await page.screenshot({ path: testInfo.outputPath("cabinet-settings-icon.png"), scale: "css" });
    await button.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByTestId("profile-settings-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("data-profile-settings-section", "account");
    await dialog.locator('[data-profile-modal-close="true"]').click();
    await expect(dialog).toBeHidden();
    await expect(button).toBeFocused();
  }
  assertNoErrors();
});
