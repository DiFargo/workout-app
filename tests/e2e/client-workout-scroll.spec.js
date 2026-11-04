import { expect, test, webkit, isolateTelegramSdk } from './app-test.js';
import { failOnRuntimeErrors } from './runtime-errors.js';

const exerciseUrl = '/cssV2?clientHarness=1&clientHarnessPage=workoutRunStage&clientWorkoutRunStage=exercise&clientHarnessTheme=warm-light';

test('WebKit workout content can scroll clear of the fixed rest dock', async ({ baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Run the WebKit regression once.');
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await isolateTelegramSdk(page);
    const assertNoErrors = failOnRuntimeErrors(page);
    for (const viewport of [{ width: 402, height: 874 }, { width: 375, height: 667 }, { width: 874, height: 402 }]) {
      await page.setViewportSize(viewport);
      await page.goto(`${exerciseUrl}&clientWorkoutRunSets=6`);
      const deck = page.getByTestId('workout-run-stage');
      await expect(page.getByTestId('workout-plan-card')).toBeVisible();
      await deck.evaluate(el => { el.scrollTop = el.scrollHeight; });
      const metrics = await page.evaluate(() => {
        const deck = document.querySelector('[data-testid="workout-run-stage"]');
        const support = document.querySelector('[data-testid="workout-plan-card"]');
        const dock = document.querySelector('[data-css-module-scope="workout-stage-action-panel"]');
        return { scrollTop: deck.scrollTop, scrollHeight: deck.scrollHeight, clientHeight: deck.clientHeight,
          contentBottom: support.getBoundingClientRect().bottom, dockTop: dock.getBoundingClientRect().top };
      });
      if (metrics.scrollHeight > metrics.clientHeight) expect(metrics.scrollTop, JSON.stringify(metrics)).toBeGreaterThan(0);
      expect(metrics.contentBottom, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.dockTop - 8);
      await page.screenshot({ path: testInfo.outputPath(`webkit-scrolled-${viewport.width}.png`) });
    }
    assertNoErrors();
  } finally {
    await browser.close();
  }
});

test('square video and current set scroll clear of the dock with safe areas and touch', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Touch emulation needs a mobile context.');
  const assertNoErrors = failOnRuntimeErrors(page);
  const cdp = await page.context().newCDPSession(page);
  for (const viewport of [{ width: 402, height: 874 }, { width: 375, height: 812 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(viewport);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, bottom: 34, left: 0, right: 0 } });
    await page.goto(exerciseUrl);
    const support = page.getByTestId('workout-plan-card');
    await expect(support).toBeVisible({ timeout: 15000 });
    const dock = page.locator('[data-css-module-scope="workout-stage-action-panel"]');
    const frame = await page.getByTestId('workout-exercise-video-frame').boundingBox();
    expect(frame.width / frame.height).toBeCloseTo(1, 2);
    const deck = page.getByTestId('workout-run-stage');
    await deck.evaluate(el => { el.scrollTop = el.scrollHeight; });
    expect((await support.boundingBox()).y + (await support.boundingBox()).height).toBeLessThanOrEqual((await dock.boundingBox()).y - 8);
    await expect(page.getByTestId('workout-exercise-set-row')).toHaveCount(1);
    await page.screenshot({ path: testInfo.outputPath(`phone-square-scrolled-${viewport.width}.png`) });
  }

  // A single-current-set screen can fit a normal phone. A short viewport
  // still verifies that real touch scrolling reaches content above the dock.
  await page.setViewportSize({ width: 375, height: 480 });
  await page.goto(`${exerciseUrl}&clientWorkoutRunSets=6`);
  const deck = page.getByTestId('workout-run-stage');
  await expect(page.getByTestId('workout-exercise-set-row')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Все подходы, выбран подход \d из 6/ })).toBeVisible();
  expect(await deck.evaluate(el => el.scrollTop)).toBe(0);
  for (let swipe = 0; swipe < 2; swipe += 1) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 190, y: 270 }] });
    for (let y = 250; y >= 90; y -= 20) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 190, y }] });
      await page.waitForTimeout(20);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await expect.poll(() => deck.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await deck.evaluate(el => { el.scrollTop = el.scrollHeight; });
  const supportBox = await page.getByTestId('workout-plan-card').boundingBox();
  const dockBox = await page.locator('[data-css-module-scope="workout-stage-action-panel"]').boundingBox();
  expect(supportBox.y + supportBox.height).toBeLessThanOrEqual(dockBox.y - 8);
  await page.screenshot({ path: testInfo.outputPath('phone-six-sets-scrolled.png') });
  assertNoErrors();
});
