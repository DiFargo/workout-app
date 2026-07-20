import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(60_000);

async function expectRect(locator, expected) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect({
    x: Math.round(box.x),
    y: Math.round(box.y),
    width: Math.round(box.width),
    height: Math.round(box.height)
  }).toEqual(expected);
}

test("calm iOS client screens match the 402 by 874 reference geometry", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "The reference uses one deterministic mobile browser.");
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);

  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto("/?clientHarness=1&clientHarnessTheme=warm-light");

  await expect(page.getByTestId("profile-main-header")).toHaveCSS("position", "sticky");
  await expectRect(page.getByTestId("profile-main-title"), { x: 169, y: 73, width: 63, height: 22 });
  await expectRect(page.getByTestId("profile-main-notifications"), { x: 338, y: 62, width: 44, height: 44 });
  await expectRect(page.getByTestId("profile-main-hero"), { x: 16, y: 126, width: 370, height: 96 });
  await expectRect(page.getByTestId("profile-main-next-workout"), { x: 16, y: 236, width: 370, height: 128 });
  await expectRect(page.getByTestId("profile-progress-card"), { x: 16, y: 378, width: 370, height: 136 });
  await expectRect(page.getByTestId("profile-measurement-snapshot"), { x: 16, y: 528, width: 370, height: 174 });
  await expectRect(page.getByTestId("profile-main-last-workout"), { x: 16, y: 716, width: 370, height: 50 });
  await expectRect(page.getByTestId("client-bottom-nav"), { x: 10, y: 784, width: 382, height: 76 });

  await page.getByTestId("client-nav-cabinet").click();
  await expect(page.getByTestId("profile-cabinet-title")).toHaveText("Кабинет");
  await expectRect(page.getByTestId("profile-cabinet-title-row"), { x: 20, y: 62, width: 362, height: 44 });
  await expectRect(page.getByTestId("profile-cabinet-action-account"), { x: 16, y: 126, width: 370, height: 100 });
  await expectRect(page.getByTestId("profile-cabinet-action-body-control"), { x: 17, y: 277, width: 368, height: 70 });
  await expectRect(page.getByTestId("profile-cabinet-action-workout-journal"), { x: 17, y: 417, width: 368, height: 70 });
  await expectRect(page.getByTestId("profile-cabinet-action-questionnaire"), { x: 17, y: 539, width: 368, height: 70 });
  await expectRect(page.getByTestId("profile-cabinet-action-feedback"), { x: 17, y: 679, width: 368, height: 70 });
  await expectRect(page.getByTestId("client-bottom-nav"), { x: 10, y: 784, width: 382, height: 76 });

  await page.getByTestId("client-nav-nutrition").click();
  await expect(page.locator('[data-nutrition-header-part="title"]')).toHaveText("Питание");
  await expectRect(page.locator('[data-nutrition-header-part="title-row"]'), { x: 20, y: 62, width: 362, height: 44 });
  await expectRect(page.getByTestId("nutrition-header-search"), { x: 286, y: 62, width: 44, height: 44 });
  await expectRect(page.getByTestId("nutrition-header-calendar"), { x: 338, y: 62, width: 44, height: 44 });
  await expectRect(page.locator('[data-nutrition-header-part="week"]'), { x: 16, y: 126, width: 370, height: 64 });
  await expectRect(page.getByTestId("nutrition-orbit"), { x: 16, y: 202, width: 370, height: 270 });
  await expectRect(page.locator('[data-css-module-scope="nutrition-diary"]'), { x: 16, y: 484, width: 370, height: 35 });
  await expectRect(page.getByTestId("nutrition-diary-list"), { x: 16, y: 519, width: 370, height: 150 });
  await expectRect(page.getByTestId("nutrition-summary"), { x: 16, y: 685, width: 370, height: 72 });
  await expectRect(page.getByTestId("client-bottom-nav"), { x: 10, y: 784, width: 382, height: 76 });

  await page.goto("/cssV2?clientHarness=1&clientHarnessPage=workoutRunStage&clientWorkoutRunStage=exercise&clientHarnessTheme=warm-light");
  await expectRect(page.getByRole("button", { name: "Вернуться к предыдущему экрану" }), { x: 16, y: 58, width: 44, height: 44 });
  await expectRect(page.getByRole("button", { name: "Выйти из тренировки" }), { x: 342, y: 58, width: 44, height: 44 });
  await expectRect(page.locator('[data-css-module-scope="workout-stage-heading"]'), { x: 16, y: 58, width: 370, height: 44 });
  await expectRect(page.getByTestId("workout-exercise-progress"), { x: 160, y: 108, width: 82, height: 25 });
  await expectRect(page.getByTestId("workout-exercise-video-frame"), { x: 16, y: 132, width: 370, height: 280 });
  await expectRect(page.getByTestId("workout-exercise-video-frame").locator("video"), { x: 28, y: 145, width: 346, height: 250 });
  await expectRect(page.getByTestId("workout-plan-section"), { x: 16, y: 425, width: 370, height: 295 });
  await expectRect(page.getByTestId("workout-plan-card"), { x: 16, y: 462, width: 370, height: 258 });
  await expectRect(page.getByTestId("workout-rest-timer"), { x: 16, y: 733, width: 370, height: 54 });
  await expectRect(page.locator('[data-css-module-scope="workout-stage-action-panel"]'), { x: 0, y: 797, width: 402, height: 77 });

  assertNoRuntimeErrors();
});
