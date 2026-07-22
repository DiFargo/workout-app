import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test("four primary client page titles use the enlarged shared size", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await page.goto("/?clientHarness=1");
  await expect(page.getByTestId("profile-main-title")).toHaveCSS("font-size", "20px");

  await page.getByTestId("client-nav-workouts").click();
  await expect(page.getByTestId("workout-list-title")).toHaveCSS("font-size", "20px");

  await page.getByTestId("client-nav-nutrition").click();
  await expect(page.locator('[data-nutrition-header-part="title"]')).toHaveCSS("font-size", "20px");

  await page.getByTestId("client-nav-cabinet").click();
  await expect(page.getByTestId("profile-cabinet-title")).toHaveCSS("font-size", "20px");

  assertNoRuntimeErrors();
});
