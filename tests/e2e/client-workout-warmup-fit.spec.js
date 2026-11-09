import { expect, test, webkit, isolateTelegramSdk } from './app-test.js';
import { failOnRuntimeErrors } from './runtime-errors.js';

const url = '/?clientHarness=1&clientHarnessPage=workoutRunStage&clientWorkoutRunStage=warmup&clientHarnessTheme=warm-light';
const dockSelector = '[data-css-module-scope="workout-stage-action-panel"]';

async function expectWarmupFits(page) {
  const deck = page.getByTestId('workout-run-stage');
  await expect(deck).toBeVisible({ timeout: 40_000 });
  await expect(deck).toHaveAttribute('data-workout-stage', 'warmup');
  await expect.poll(() => deck.evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
  expect(await deck.evaluate(el => el.scrollTop)).toBe(0);
  const card = await page.getByTestId('workout-stage-card').boundingBox();
  const dock = await page.locator(dockSelector).boundingBox();
  expect(card.y + card.height).toBeLessThanOrEqual(dock.y - 8);
  expect(dock.y + dock.height).toBeLessThanOrEqual(page.viewportSize().height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  for (const button of await page.getByTestId('workout-stage-card').getByRole('button').all()) {
    const box = await button.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(48);
    expect(box.width).toBeGreaterThanOrEqual(48);
    expect(box.y + box.height).toBeLessThan(dock.y);
  }
}

test('warmup fits above the dock at portrait phone sizes including system safe areas', async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(90_000);
  const context = await browser.newContext({ baseURL, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await isolateTelegramSdk(page);
  const assertNoErrors = failOnRuntimeErrors(page);
  const cdp = await context.newCDPSession(page);
  try {
    for (const profile of [
      { name: 'iphone-17-pro', width: 402, height: 874, top: 62, bottom: 34 },
      { name: 'iphone-393', width: 393, height: 852, top: 59, bottom: 34 },
      { name: 'android', width: 360, height: 740, top: 24, bottom: 24 },
      { name: 'small-phone', width: 375, height: 667, top: 20, bottom: 0 },
      { name: 'narrow-phone', width: 320, height: 640, top: 0, bottom: 24 },
      { name: 'reference', width: 447, height: 898, top: 0, bottom: 0 }
    ]) {
      await page.setViewportSize({ width: profile.width, height: profile.height });
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: profile.top, bottom: profile.bottom, left: 0, right: 0 } });
      await page.goto(url);
      await expectWarmupFits(page);
      await page.screenshot({ path: testInfo.outputPath(`${profile.name}.png`) });
    }
    assertNoErrors();
  } finally { await context.close(); }
});

test('warmup refits live and keeps step confirmation, presets, timer and start navigation', async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto(url);
  const card = page.getByTestId('workout-stage-card');
  await expectWarmupFits(page);
  const originalHeight = (await card.boundingBox()).height;
  await page.getByRole('button', { name: /Кардио/ }).click();
  await expect(card).toContainText('0 из 3 шагов');
  await page.getByRole('button', { name: '3 мин', exact: true }).click();
  await expect(card).toContainText('3:00');
  await page.getByRole('button', { name: 'Старт', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Пауза', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 360, height: 740 });
  await expectWarmupFits(page);
  expect((await card.boundingBox()).height).toBeLessThan(originalHeight);
  await expect(card).toContainText('0 из 3 шагов');
  await page.getByRole('button', { name: 'Пауза', exact: true }).click();
  await page.getByRole('button', { name: '5 мин', exact: true }).click();
  await expect(card).toContainText('5:00');
  await page.getByRole('button', { name: 'Начать тренировку', exact: true }).click();
  await expect(page.getByTestId('workout-exercise-set-row')).toHaveCount(1);
  await expect(page.getByTestId('workout-primary-action')).toHaveAccessibleName('Завершить подход');
  await page.getByRole('button', { name: 'Предыдущее упражнение', exact: true }).click();
  await expectWarmupFits(page);
  assertNoErrors();
});

test('WebKit keeps all warmup content reachable in landscape and with enlarged text', async ({ baseURL }, testInfo) => {
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage({ baseURL, viewport: { width: 402, height: 874 }, isMobile: true, hasTouch: true });
    await isolateTelegramSdk(page);
    const assertNoErrors = failOnRuntimeErrors(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(url);
    await expectWarmupFits(page);
    for (const profile of [
      { name: 'landscape', width: 874, height: 402, fontSize: '16px' },
      { name: 'large-text', width: 375, height: 667, fontSize: '32px' }
    ]) {
      await page.setViewportSize({ width: profile.width, height: profile.height });
      await page.evaluate(size => { document.documentElement.style.fontSize = size; }, profile.fontSize);
      const deck = page.getByTestId('workout-run-stage');
      await expect.poll(async () => {
        const reserved = await page.locator('[data-css-module-scope="workout-run-page"]').evaluate(el => parseFloat(el.style.getPropertyValue('--workout-dock-height')));
        return Math.abs(reserved - (await page.locator(dockSelector).boundingBox()).height);
      }).toBeLessThanOrEqual(1);
      await deck.evaluate(el => { el.scrollTop = el.scrollHeight; });
      const timerButton = page.getByRole('button', { name: 'Старт', exact: true });
      await timerButton.click({ trial: true });
      const timer = await timerButton.boundingBox();
      const dock = await page.locator(dockSelector).boundingBox();
      expect(timer.y + timer.height).toBeLessThanOrEqual(dock.y - 8);
      expect(await deck.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: testInfo.outputPath(`${profile.name}.png`) });
    }
    assertNoErrors();
  } finally { await browser.close(); }
});
