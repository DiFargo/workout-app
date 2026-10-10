import { expect, test } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test("selected off-centre crop is inline only; fullscreen keeps the same complete original", async ({ page }, info) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto("/?clientHarness=1&clientHarnessPage=exerciseVideo&clientExerciseVideoCrop=1");
  const frame = page.getByTestId("workout-exercise-video-frame");
  const video = frame.locator("video");
  await expect(video).toHaveCSS("object-fit", "cover");
  await expect(video).toHaveCSS("object-position", "20% 80%");
  await expect(video).toHaveCSS("transform", "matrix(1.5, 0, 0, 1.5, 0, 0)");
  const rect = await frame.boundingBox();
  expect(rect.width / rect.height).toBeCloseTo(4 / 3, 2);
  await frame.getByRole("button", { name: "Воспроизвести видео упражнения" }).click();
  await page.screenshot({ path: info.outputPath("off-centre-crop-inline.png") });
  await frame.getByRole("button", { name: "Развернуть видео на весь экран" }).click();
  const overlay = page.getByTestId("workout-fullscreen-video-overlay");
  await expect(overlay.locator("video")).toHaveAttribute("src", await video.getAttribute("src"));
  await expect(overlay.locator("video")).toHaveCSS("object-fit", "contain");
  await expect(overlay.locator("video")).toHaveCSS("transform", "none");
  await page.screenshot({ path: info.outputPath("off-centre-crop-fullscreen-original.png") });
  await overlay.getByRole("button", { name: "Закрыть видео" }).click();
  await expect(video).toHaveCSS("object-position", "20% 80%");
  assertNoErrors();
});

test("exercise video is full-width 4:3 with contained glass controls", async ({ page }, testInfo) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  for (const viewport of [{ width: 402, height: 874 }, { width: 320, height: 720 }, { width: 375, height: 812 }, { width: 874, height: 402 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/?clientHarness=1&clientHarnessPage=workoutRunStage&clientWorkoutRunStage=exercise");
    const frame = page.getByTestId("workout-exercise-video-frame");
    await expect(frame).toBeVisible();
    const geometry = await frame.evaluate((el) => {
      const rect = (node) => {
        const { x, y, width, height } = node.getBoundingClientRect();
        return { x, y, width, height };
      };
      return {
        frame: rect(el), content: rect(el.parentElement), video: rect(el.querySelector("video")),
        fit: getComputedStyle(el.querySelector("video")).objectFit,
        buttons: [...el.querySelectorAll("button")].map(button => ({
          ...rect(button), blur: getComputedStyle(button).backdropFilter,
          color: getComputedStyle(button).color, radius: getComputedStyle(button).borderRadius
        }))
      };
    });
    expect(geometry.frame.width / geometry.frame.height).toBeCloseTo(4 / 3, 2);
    expect(geometry.frame.width).toBeCloseTo(geometry.content.width, 0);
    expect(geometry.video.width).toBeCloseTo(geometry.frame.width, 0);
    expect(geometry.video.height).toBeCloseTo(geometry.frame.height, 0);
    expect(geometry.fit).toBe("contain");
    expect(geometry.buttons).toHaveLength(1);
    for (const button of geometry.buttons) {
      expect(button.width).toBeGreaterThanOrEqual(44);
      expect(button.width).toBe(button.height);
      expect(button.blur).toContain("blur(12px)");
      expect(button.color).toBe("rgb(255, 255, 255)");
      expect(button.radius).toBe("50%");
      expect(button.x).toBeGreaterThan(geometry.frame.x);
      expect(button.y).toBeGreaterThan(geometry.frame.y);
      expect(button.x + button.width).toBeLessThan(geometry.frame.x + geometry.frame.width);
      expect(button.y + button.height).toBeLessThan(geometry.frame.y + geometry.frame.height);
    }
    const play = geometry.buttons[0];
    expect(play.x + play.width / 2).toBeCloseTo(geometry.frame.x + geometry.frame.width / 2, 0);
    expect(play.y + play.height / 2).toBeCloseTo(geometry.frame.y + geometry.frame.height / 2, 0);
    await page.screenshot({ path: testInfo.outputPath(`4-3-video-${viewport.width}.png`) });
  }
  assertNoErrors();
});

test("glass play, pause and fullscreen controls remain functional and keyboard accessible", async ({ page }, testInfo) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto("/?clientHarness=1&clientHarnessPage=exerciseVideo");
  const frame = page.getByTestId("workout-exercise-video-frame");
  const video = frame.locator("video");
  const fullscreen = frame.getByRole("button", { name: "Развернуть видео на весь экран" });
  await expect(fullscreen).toHaveCount(0);
  await frame.getByRole("button", { name: "Воспроизвести видео упражнения" }).click();
  await expect.poll(() => video.evaluate(el => el.paused)).toBe(false);
  await expect(fullscreen).toBeVisible();
  const fullscreenBox = await fullscreen.boundingBox();
  expect(fullscreenBox.width).toBeGreaterThanOrEqual(44);
  expect(fullscreenBox.height).toBe(fullscreenBox.width);
  await expect(fullscreen).toHaveCSS("border-radius", "50%");
  await page.screenshot({ path: testInfo.outputPath("4-3-video-playing.png") });
  await frame.getByRole("button", { name: "Поставить видео на паузу" }).click();
  await expect.poll(() => video.evaluate(el => el.paused)).toBe(true);
  await expect(fullscreen).toHaveCount(0);
  await frame.getByRole("button", { name: "Воспроизвести видео упражнения" }).click();
  await fullscreen.click();
  const overlay = page.getByTestId("workout-fullscreen-video-overlay");
  await expect(overlay).toBeVisible();
  await expect.poll(() => video.evaluate(el => el.paused)).toBe(true);
  await overlay.getByRole("button", { name: "Закрыть видео" }).click();
  await expect(overlay).toHaveCount(0);
  await expect(fullscreen).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const play = frame.getByRole("button", { name: "Воспроизвести видео упражнения" });
  await play.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(play).toBeFocused();
  await expect(play).toHaveCSS("outline-style", "solid");
  const transitionDurations = await play.evaluate(el => getComputedStyle(el).transitionDuration);
  expect(transitionDurations.split(",").every(value => parseFloat(value) <= 0.001)).toBe(true);
  await page.keyboard.press("Enter");
  await expect.poll(() => video.evaluate(el => el.paused)).toBe(false);
  await expect(frame.getByRole("button", { name: "Поставить видео на паузу" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(() => video.evaluate(el => el.paused)).toBe(true);
  await expect(fullscreen).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("glass-keyboard-focus.png") });
  await page.keyboard.press("Enter");
  await expect(fullscreen).toBeVisible();
  await video.evaluate(el => { el.currentTime = el.duration - 0.1; });
  await expect.poll(() => video.evaluate(el => el.ended)).toBe(true);
  await expect(fullscreen).toHaveCount(0);
  assertNoErrors();
});
