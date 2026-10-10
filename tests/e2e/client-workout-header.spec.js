import { expect, test } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

const exerciseUrl = "/cssV2?clientHarness=1&clientHarnessPage=workoutRunStage&clientWorkoutRunStage=exercise";

test.setTimeout(90_000);

async function openWorkoutHarness(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.getByTestId("client-harness-workout-run-stage")).toBeVisible({ timeout: 40_000 });
}

test("compact exercise heading stays centered above the video with a single exit", async ({ page }, testInfo) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  for (const viewport of [{ width: 320, height: 720 }, { width: 393, height: 852 }, { width: 427, height: 898 }, { width: 812, height: 375 }]) {
    await page.setViewportSize(viewport);
    await openWorkoutHarness(page, exerciseUrl);
    const heading = page.locator('[data-css-module-scope="workout-stage-heading"]');
    const title = heading.locator(":scope > div > span").first();
    const progress = page.getByTestId("workout-exercise-progress");
    const exit = page.getByRole("button", { name: "Выйти из тренировки" });
    await expect(heading).toBeVisible();
    await expect(page.getByTestId("workout-exercise-support")).toHaveCount(0);
    await expect(page.getByText(/Предыдущий результат:|Прошлый раз:/)).toHaveCount(0);
    await expect(page.locator('[data-css-module-control="workout-run-overlays"]')).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Вернуться к предыдущему экрану" })).toHaveCount(0);
    await expect(title).toHaveCSS("text-align", "center");
    await expect(title).toHaveCSS("font-size", "17px");
    const titleBox = await title.boundingBox();
    const progressBox = await progress.boundingBox();
    const headerBox = await heading.boundingBox();
    const videoBox = await page.getByTestId("workout-exercise-video-frame").boundingBox();
    const exitBox = await exit.boundingBox();
    expect(titleBox.x + titleBox.width / 2).toBeCloseTo(viewport.width / 2, 0);
    expect(progressBox.x + progressBox.width / 2).toBeCloseTo(viewport.width / 2, 0);
    expect(progressBox.y).toBeGreaterThanOrEqual(titleBox.y + titleBox.height);
    expect(videoBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height);
    // The media container owns the ratio; this inner frame can compute to auto.
    expect(videoBox.width).toBeCloseTo(videoBox.height * 4 / 3, 0);
    expect(exitBox.width).toBeGreaterThanOrEqual(44);
    expect(exitBox.height).toBeGreaterThanOrEqual(44);
    expect(titleBox.x + titleBox.width).toBeLessThan(exitBox.x);
    await page.screenshot({ path: testInfo.outputPath(`compact-header-${viewport.width}.png`) });

    const deck = page.getByTestId("workout-run-stage");
    await deck.evaluate(el => { el.scrollTop = el.scrollHeight; });
    expect((await heading.boundingBox()).y).toBe(headerBox.y);
    await expect(exit).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }

  await page.setViewportSize({ width: 320, height: 720 });
  await openWorkoutHarness(page, exerciseUrl);
  const heading = page.locator('[data-css-module-scope="workout-stage-heading"]');
  const title = heading.locator(":scope > div > span").first();
  // Stress the existing title layout without changing workout data.
  await title.evaluate(el => {
    el.textContent = "Тяга гантели одной рукой с опорой на наклонную скамью";
    el.style.fontSize = "24px";
  });
  const titleBox = await title.boundingBox();
  const headerBox = await heading.boundingBox();
  const videoBox = await page.getByTestId("workout-exercise-video-frame").boundingBox();
  expect(titleBox.y + titleBox.height).toBeLessThan(headerBox.y + headerBox.height);
  expect(videoBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height);
  expect(await title.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  await page.getByRole("button", { name: "Выйти из тренировки" }).click();
  await expect(page.getByTestId("client-harness-main")).toBeVisible();
  assertNoErrors();
});

test("removing the previous result preserves first-set feedback in the basic program", async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await openWorkoutHarness(page, `${exerciseUrl}&clientWorkoutRunMode=basic&clientWorkoutRunStartingWeight=1`);
  const feedback = page.getByTestId("basic-workout-starting-weight-check");
  await expect(feedback).toBeVisible();
  await expect(feedback.getByRole("button")).toHaveCount(3);
  await expect(page.getByText(/Предыдущий результат:|Прошлый раз:/)).toHaveCount(0);
  const rows = page.getByTestId("workout-exercise-set-row");
  const values = (await rows.allTextContents()).map(text => text.match(/\d+(?:[.,]\d+)?/g));
  await feedback.getByRole("button", { name: "Норма", exact: true }).click();
  await expect(page.getByTestId("workout-exercise-support")).toHaveCount(0);
  expect((await rows.allTextContents()).map(text => text.match(/\d+(?:[.,]\d+)?/g))).toEqual(values);
  assertNoErrors();
});
