import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(120_000);

const warmLightSurfaces = [
  ["profile", "/?clientHarness=1&clientHarnessTheme=warm-light"],
  ["onboarding", "/?clientHarness=1&clientHarnessPage=firstSetup&clientFirstSetupStep=1&clientHarnessTheme=warm-light"],
  ["onboarding goal", "/?clientHarness=1&clientHarnessPage=firstSetup&clientFirstSetupStep=7&clientHarnessTheme=warm-light"],
  ["profile settings", "/?clientHarness=1&clientHarnessPage=profileSettingsTab&clientHarnessTheme=warm-light"],
  ["avatar crop", "/?clientHarness=1&clientHarnessPage=avatarCrop&clientHarnessTheme=warm-light"],
  ["measurement panel", "/?clientHarness=1&clientHarnessPage=measurementPanel&clientHarnessTheme=warm-light"],
  ["measurement wizard", "/?clientHarness=1&clientHarnessPage=measurementWizard&clientMeasurementStep=measurement&clientHarnessTheme=warm-light"],
  ["AI coach", "/?clientHarness=1&clientHarnessPage=aiCoach&clientHarnessTheme=warm-light"],
  ["workout plan", "/cssV2?clientHarness=1&clientHarnessPage=workoutPlan&clientHarnessTheme=warm-light"],
  ["workout history", "/cssV2?clientHarness=1&clientHarnessPage=workoutHistory&clientHarnessTheme=warm-light"],
  ["workout mode", "/cssV2?clientHarness=1&clientHarnessPage=workoutMode&clientHarnessTheme=warm-light"],
  ["workout quiz", "/cssV2?clientHarness=1&clientHarnessPage=basicQuiz&clientHarnessTheme=warm-light"],
  ["workout dialogs", "/?clientHarness=1&clientHarnessPage=workoutDialogs&clientWorkoutDialog=readiness&clientHarnessTheme=warm-light"],
  ["workout warmup", "/cssV2?clientHarness=1&clientHarnessPage=workoutRunStage&clientWorkoutRunStage=warmup&clientHarnessTheme=warm-light"],
  ["workout finish", "/cssV2?clientHarness=1&clientHarnessPage=workoutRunStage&clientWorkoutRunStage=finish&clientHarnessTheme=warm-light"],
  ["nutrition search", "/cssV2?clientHarness=1&clientHarnessPage=nutritionSearchHistory&clientHarnessTheme=warm-light"],
  ["dish ingredients", "/cssV2?clientHarness=1&clientHarnessPage=nutritionDishIngredients&clientHarnessTheme=warm-light"],
  ["photo analysis", "/cssV2?clientHarness=1&clientHarnessPage=nutritionPhotoPreview&clientHarnessTheme=warm-light"],
  ["meal sheet", "/cssV2?clientHarness=1&clientHarnessPage=nutritionMealModal&clientHarnessTheme=warm-light"],
  ["delete confirmation", "/cssV2?clientHarness=1&clientHarnessPage=nutritionDeleteConfirm&clientHarnessTheme=warm-light"],
  ["undo toast", "/cssV2?clientHarness=1&clientHarnessPage=nutritionUndoToast&clientHarnessTheme=warm-light"]
];

const legacyAccentFragments = [
  "101, 82, 230",
  "90, 73, 223",
  "93, 67, 238",
  "107, 85, 246",
  "117, 101, 232",
  "79, 53, 232",
  "127, 159, 58",
  "145, 173, 78",
  "168, 211, 76",
  "181, 230, 85"
];

test("all client warm-light flows use one calm iOS visual system", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "The iPhone reference is verified in one deterministic browser.");
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await page.setViewportSize({ width: 402, height: 874 });

  for (const [surfaceName, url] of warmLightSurfaces) {
    await test.step(surfaceName, async () => {
      await page.goto(url);
      await expect(page.locator("html")).toHaveAttribute("data-app-theme", "warm-light");
      await expect(page.locator('[data-testid^="client-harness-"]').first()).toBeAttached({ timeout: 40_000 });
      await expect(page.locator("body")).toBeVisible();
      await expect(page.locator("body")).toHaveCSS("background-color", "rgb(247, 245, 248)");

      const audit = await page.evaluate((blockedFragments) => {
        const html = document.documentElement;
        const bodyStyles = getComputedStyle(document.body);
        const offenders = [];

        for (const element of document.querySelectorAll("body *")) {
          const rect = element.getBoundingClientRect();
          const styles = getComputedStyle(element);
          if (
            rect.width <= 0
            || rect.height <= 0
            || styles.display === "none"
            || styles.visibility === "hidden"
            || Number(styles.opacity) === 0
          ) continue;

          const renderedPaint = [
            styles.color,
            styles.backgroundColor,
            styles.backgroundImage,
            styles.borderColor,
            styles.boxShadow
          ].join(" ");

          if (blockedFragments.some((fragment) => renderedPaint.includes(fragment))) {
            offenders.push({
              element: element.tagName.toLowerCase(),
              className: String(element.className).slice(0, 120),
              paint: renderedPaint.slice(0, 240)
            });
          }

          if (offenders.length >= 8) break;
        }

        return {
          background: bodyStyles.backgroundColor,
          fontFamily: bodyStyles.fontFamily,
          horizontalOverflow: Math.max(0, html.scrollWidth - html.clientWidth),
          offenders
        };
      }, legacyAccentFragments);

      expect(audit.background).toBe("rgb(247, 245, 248)");
      expect(audit.fontFamily.toLowerCase()).toContain("apple-system");
      expect(audit.horizontalOverflow).toBeLessThanOrEqual(1);
      expect(audit.offenders).toEqual([]);
    });
  }

  assertNoRuntimeErrors();
});
