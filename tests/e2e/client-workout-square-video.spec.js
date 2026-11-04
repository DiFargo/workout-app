import { expect, test } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test("selected off-centre crop is inline only; fullscreen keeps the same complete original", async ({ page }, info) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto("/?clientHarness=1&clientHarnessPage=exerciseVideo&clientExerciseVideoCrop=1");
  const frame = page.getByTestId("workout-exercise-video-frame");
  // A cold Vite dev server may still be compiling the lazy route after goto.
  // Geometry assertions begin only once the actual fixture has mounted.
  await frame.waitFor({ state: "visible", timeout: 30000 });
  const video = frame.locator("video");
  await expect(video).toHaveCSS("object-fit", "cover");
  await expect(video).toHaveCSS("object-position", "20% 80%");
  await expect(video).toHaveCSS("transform", "matrix(1.5, 0, 0, 1.5, 0, 0)");
  const rect = await frame.boundingBox();
  expect(rect.width / rect.height).toBeCloseTo(1, 2);
  await frame.getByRole("button", { name: "Воспроизвести видео упражнения" }).click();
  await page.screenshot({ path: info.outputPath("off-centre-crop-inline.png") });
  await frame.getByRole("button", { name: "Развернуть видео на весь экран" }).click();
  const overlay = page.getByTestId("workout-fullscreen-video-overlay");
  const fullscreenVideo = overlay.locator("video");
  await expect(fullscreenVideo).toHaveAttribute("src", await video.getAttribute("src"));
  await expect(fullscreenVideo).toHaveAttribute("controlslist", "nodownload noremoteplayback");
  await expect(fullscreenVideo).toHaveAttribute("disablepictureinpicture", "");
  await expect(overlay.getByTestId("workout-video-watermark")).toContainText(/^ZMENA · /);
  await expect(overlay.locator("video")).toHaveCSS("object-fit", "contain");
  await expect(overlay.locator("video")).toHaveCSS("transform", "none");
  await page.screenshot({ path: info.outputPath("off-centre-crop-fullscreen-original.png") });
  await overlay.getByRole("button", { name: "Закрыть видео" }).click();
  await expect(video).toHaveCSS("object-position", "20% 80%");
  assertNoErrors();
});

test("square exercise video leaves the selected set visible and keeps a compact unobtrusive play control", async ({ page }, testInfo) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  for (const viewport of [{ width: 402, height: 874 }, { width: 338, height: 640 }, { width: 320, height: 720 }, { width: 375, height: 812 }, { width: 567, height: 1280 }, { width: 874, height: 402 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/?clientHarness=1&clientHarnessPage=workoutRunStage&clientWorkoutRunStage=exercise&clientHarnessTheme=warm-light");
    const frame = page.getByTestId("workout-exercise-video-frame");
    await expect(frame).toBeVisible();
    const geometry = await frame.evaluate((el) => {
      const rect = (node) => {
        const { x, y, width, height } = node.getBoundingClientRect();
        return { x, y, width, height };
      };
      return {
        frame: rect(el), content: rect(el.parentElement), video: rect(el.querySelector("video")),
        plan: rect(document.querySelector('[data-testid="workout-plan-card"]')),
        fit: getComputedStyle(el.querySelector("video")).objectFit,
        buttons: [...el.querySelectorAll("button")].map(button => {
          const box = rect(button), style = getComputedStyle(button);
          const frame = el.getBoundingClientRect();
          return { ...box, color: style.color, radius: style.borderRadius, opacity: style.opacity,
            backgroundImage: style.backgroundImage, icon: rect(button.querySelector("svg")),
            outsideHits: [[.15, .5], [.85, .5], [.5, .15], [.5, .85]].map(([x, y]) => {
              const point = { x: frame.x + frame.width * x, y: frame.y + frame.height * y };
              return point.x >= 0 && point.x < innerWidth && point.y >= 0 && point.y < innerHeight
                ? button.contains(document.elementFromPoint(point.x, point.y)) : false;
            }) };
        })
      };
    });
    expect(geometry.frame.width / geometry.frame.height).toBeCloseTo(1, 2);
    expect(geometry.frame.width).toBeCloseTo(geometry.content.width, 0);
    if (viewport.width <= 640 && viewport.height > viewport.width) {
      const row = await page.getByTestId("workout-exercise-set-row").boundingBox();
      const dock = await page.locator('[data-css-module-scope="workout-stage-action-panel"]').boundingBox();
      expect(row.y + row.height).toBeLessThanOrEqual(dock.y - 8);
      expect(await page.getByTestId("workout-run-stage").evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
      expect(geometry.frame.width / geometry.plan.width).toBeGreaterThanOrEqual(0.72);
    }
    expect(geometry.video.width).toBeCloseTo(geometry.frame.width, 0);
    expect(geometry.video.height).toBeCloseTo(geometry.frame.height, 0);
    expect(geometry.fit).toBe("contain");
    expect(geometry.buttons).toHaveLength(1);
    for (const button of geometry.buttons) {
      expect(button.width).toBeGreaterThanOrEqual(44);
      // A touch-sized target should not become a large visual panel over the
      // demonstration. These are broad bounds, not one reversible CSS preset.
      expect(button.width).toBeLessThanOrEqual(64);
      // On a very low landscape viewport the frame can be smaller than a
      // normal touch target; keep the target accessible without covering it.
      const areaDivisor = viewport.width > viewport.height ? 3 : 6;
      expect(button.width * button.height).toBeLessThan(geometry.frame.width * geometry.frame.height / areaDivisor);
      expect(button.width).toBe(button.height);
      expect(button.backgroundImage).toBe("none");
      expect(Number(button.opacity)).toBe(1);
      expect(button.color).toBe("rgb(255, 255, 255)");
      expect(button.radius).toBe("50%");
      expect(button.icon.width).toBeGreaterThan(0);
      expect(button.icon.width).toBeLessThan(button.width * .6);
      expect(button.outsideHits).toEqual([false, false, false, false]);
      expect(button.x).toBeGreaterThan(geometry.frame.x);
      expect(button.y).toBeGreaterThan(geometry.frame.y);
      expect(button.x + button.width).toBeLessThan(geometry.frame.x + geometry.frame.width);
      expect(button.y + button.height).toBeLessThan(geometry.frame.y + geometry.frame.height);
    }
    const play = geometry.buttons[0];
    expect(play.x + play.width / 2).toBeCloseTo(geometry.frame.x + geometry.frame.width / 2, 0);
    expect(play.y + play.height / 2).toBeCloseTo(geometry.frame.y + geometry.frame.height / 2, 0);
    await page.screenshot({ path: testInfo.outputPath(`square-video-${viewport.width}.png`) });
  }
  assertNoErrors();
});

test("subtle play, pause and fullscreen controls remain functional and keyboard accessible", async ({ page, browserName }, testInfo) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto("/?clientHarness=1&clientHarnessPage=exerciseVideo&clientHarnessTheme=warm-light");
  const frame = page.getByTestId("workout-exercise-video-frame");
  const video = frame.locator("video");
  await expect(video).toHaveAttribute("controlslist", "nodownload noremoteplayback");
  await expect(video).toHaveAttribute("disablepictureinpicture", "");
  await expect(video).toHaveAttribute("disableremoteplayback", "");
  await expect(video).toHaveAttribute("draggable", "false");
  await expect(frame.getByTestId("workout-video-watermark")).toContainText(/^ZMENA · /);
  expect(await video.evaluate(el => {
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    return event.defaultPrevented;
  })).toBe(true);
  const fullscreen = frame.getByRole("button", { name: "Развернуть видео на весь экран" });
  await expect(fullscreen).toHaveCount(0);
  const initialPlay = frame.getByRole("button", { name: "Воспроизвести видео упражнения" });
  const beforeHover = await initialPlay.boundingBox();
  await initialPlay.hover();
  await expect(initialPlay).toBeVisible();
  await initialPlay.click({ trial: true });
  const afterHover = await initialPlay.boundingBox();
  expect(afterHover.width).toBeCloseTo(beforeHover.width, 0);
  expect(afterHover.height).toBeCloseTo(beforeHover.height, 0);
  await page.screenshot({ path: testInfo.outputPath("subtle-play-hover.png") });
  await initialPlay.click();
  await expect.poll(() => video.evaluate(el => el.paused)).toBe(false);
  await expect(fullscreen).toBeVisible();
  const fullscreenBox = await fullscreen.boundingBox();
  expect(fullscreenBox.width).toBeGreaterThanOrEqual(44);
  expect(fullscreenBox.height).toBe(fullscreenBox.width);
  await expect(fullscreen).toHaveCSS("border-radius", "50%");
  await page.screenshot({ path: testInfo.outputPath("square-video-playing.png") });
  await frame.getByRole("button", { name: "Поставить видео на паузу" }).click();
  await expect.poll(() => video.evaluate(el => el.paused)).toBe(true);
  await expect(fullscreen).toHaveCount(0);
  await frame.getByRole("button", { name: "Воспроизвести видео упражнения" }).click();
  await fullscreen.click();
  const overlay = page.getByTestId("workout-fullscreen-video-overlay");
  await expect(overlay).toBeVisible();
  const fullscreenVideo = overlay.locator("video");
  await expect(fullscreenVideo).toHaveAttribute("controlslist", "nodownload noremoteplayback");
  await expect(fullscreenVideo).toHaveAttribute("disablepictureinpicture", "");
  await expect(overlay.getByTestId("workout-video-watermark")).toContainText(/^ZMENA · /);
  await expect.poll(() => video.evaluate(el => el.paused)).toBe(true);
  await overlay.getByRole("button", { name: "Закрыть видео" }).click();
  await expect(overlay).toHaveCount(0);
  await expect(fullscreen).toHaveCount(0);
  if (browserName === "chromium") {
    const session = await page.context().newCDPSession(page);
    await session.send("Emulation.setEmulatedMedia", { features: [
      { name: "prefers-reduced-motion", value: "reduce" },
      { name: "prefers-reduced-transparency", value: "reduce" }
    ] });
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-transparency: reduce)").matches)).toBe(true);
  } else {
    await page.emulateMedia({ reducedMotion: "reduce" });
  }
  const play = frame.getByRole("button", { name: "Воспроизвести видео упражнения" });
  await play.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(play).toBeFocused();
  await expect(play).toHaveCSS("outline-style", "solid");
  if (browserName === "chromium") {
    const reducedSurface = await play.evaluate(el => {
      const style = getComputedStyle(el);
      return { channels: style.backgroundColor.match(/[\d.]+/g).map(Number), blur: style.backdropFilter, image: style.backgroundImage };
    });
    expect(reducedSurface.blur).toBe("none");
    expect(reducedSurface.image).toBe("none");
    expect(Math.max(...reducedSurface.channels.slice(0, 3))).toBeLessThan(100);
    expect(reducedSurface.channels[3] ?? 1).toBeGreaterThanOrEqual(.95);
  }
  const transitionDurations = await play.evaluate(el => getComputedStyle(el).transitionDuration);
  expect(transitionDurations.split(",").every(value => parseFloat(value) <= 0.001)).toBe(true);
  await page.keyboard.press("Enter");
  await expect.poll(() => video.evaluate(el => el.paused)).toBe(false);
  await expect(frame.getByRole("button", { name: "Поставить видео на паузу" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(() => video.evaluate(el => el.paused)).toBe(true);
  await expect(fullscreen).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("subtle-keyboard-focus.png") });
  await page.keyboard.press("Enter");
  await expect(fullscreen).toBeVisible();
  await video.evaluate(el => { el.currentTime = el.duration - 0.1; });
  await expect.poll(() => video.evaluate(el => el.ended)).toBe(true);
  await expect(fullscreen).toHaveCount(0);
  assertNoErrors();
});
