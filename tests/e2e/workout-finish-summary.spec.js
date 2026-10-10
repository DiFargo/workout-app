import { expect, test, webkit, isolateTelegramSdk } from './app-test.js';
import { failOnRuntimeErrors } from './runtime-errors.js';

const url = (stage = 'finish') => `/cssV2?clientHarness=1&clientHarnessPage=workoutRunStage&clientWorkoutRunStage=${stage}&clientWorkoutFinishAudit=1&clientHarnessTheme=warm-light`;

async function readableStats(page) {
  const stats = page.getByTestId('workout-finish-stats');
  await expect(stats).toBeVisible({ timeout: 20000 });
  await expect(stats.locator('strong')).toHaveText(['52 мин', '7', '21', /5\s830 кг/]);
  const metrics = await stats.evaluate(el => [...el.children].map(tile => {
    const value = tile.querySelector('strong');
    const rect = value.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(value);
    return { x: tile.offsetLeft, y: tile.offsetTop, overflow: value.scrollWidth > value.clientWidth + 1,
      clipped: [...range.getClientRects()].some(text => text.left < rect.left - 1 || text.right > rect.right + 1 || text.bottom > rect.bottom + 1) };
  }));
  expect(metrics[0].y).toBe(metrics[1].y);
  expect(metrics[2].y).toBe(metrics[3].y);
  expect(metrics[2].y).toBeGreaterThan(metrics[0].y);
  expect(metrics.every(item => !item.overflow && !item.clipped)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

async function scrollToEnd(page) {
  const deck = page.getByTestId('workout-run-stage');
  await expect.poll(async () => {
    return JSON.stringify(await deck.evaluate(el => {
      el.scrollTop = el.scrollHeight;
      const content = el.querySelector('[data-testid="workout-finish-card"]').getBoundingClientRect();
      const dock = document.querySelector('[data-testid="workout-finish-actions"]').getBoundingClientRect();
      return { clearOfActions: content.bottom <= dock.top - 8,
        top: el.scrollTop, client: el.clientHeight, scroll: el.scrollHeight,
        overflow: getComputedStyle(el).overflow, bottomPadding: getComputedStyle(el).paddingBottom,
        flex: getComputedStyle(el).flex, height: getComputedStyle(el).height,
        contentBottom: content.bottom, dockTop: dock.top };
    }));
  }, { timeout: 20000 }).toMatch(/"clearOfActions":true/);
}

test('finish summary has four readable balanced tiles on phones, tablet and landscape', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'One viewport matrix.');
  const assertNoErrors = failOnRuntimeErrors(page);
  const cdp = await page.context().newCDPSession(page);
  for (const [width, height] of [[402, 874], [360, 740], [320, 640], [375, 667], [768, 1024], [874, 402]]) {
    await page.setViewportSize({ width, height });
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: width === 402 ? 62 : 0, bottom: width === 402 ? 34 : 0, left: 0, right: 0 } });
    await page.goto(url());
    await readableStats(page);
    for (const button of await page.getByTestId('workout-finish-actions').getByRole('button').all()) {
      const box = await button.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(48);
      expect(box.y + box.height).toBeLessThanOrEqual(height);
    }
    await page.screenshot({ path: info.outputPath(`finish-${width}x${height}.png`) });
    await scrollToEnd(page);
  }
  await cdp.detach();
  assertNoErrors();
});

test('finish summary wraps long values with enlarged text and preserves comment and save navigation', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'One text scaling and keyboard-layout check.');
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url());
  await readableStats(page);
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  const values = page.getByTestId('workout-finish-stats').locator('strong');
  await values.first().evaluate(el => { el.textContent = '2 ч 15 мин'; });
  await values.last().evaluate(el => { el.textContent = '123 456 кг'; });
  expect(await values.evaluateAll(items => items.every(el => el.scrollWidth <= el.clientWidth + 1 && getComputedStyle(el).textOverflow !== 'ellipsis'))).toBe(true);
  const comment = page.getByLabel('Комментарий тренеру');
  await comment.fill('Последний подход дался тяжело.');
  await page.setViewportSize({ width: 375, height: 480 });
  await scrollToEnd(page);
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await values.first().evaluate(el => { el.textContent = '52 мин'; });
  await values.last().evaluate(el => { el.textContent = '5 830 кг'; });
  await comment.scrollIntoViewIfNeeded();
  const box = await comment.boundingBox();
  expect(box.y + box.height).toBeLessThanOrEqual((await page.getByTestId('workout-finish-actions').boundingBox()).y);
  await expect(comment).toHaveValue('Последний подход дался тяжело.');
  await page.getByRole('button', { name: 'Сохранить и завершить', exact: true }).click();
  await expect(comment).toHaveCount(0);
  await expect(page.getByTestId('workout-finish-actions').getByRole('button')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Вернуться в меню', exact: true })).toBeVisible();
  await readableStats(page);
  assertNoErrors();
});

test('finish back button keeps the entered comment and completed workout values', async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.goto(url());
  await readableStats(page);
  await page.getByLabel('Комментарий тренеру').fill('Без изменений');
  await page.getByRole('button', { name: 'Вернуться к последнему упражнению' }).click();
  await expect(page.getByTestId('workout-run-stage')).toHaveAttribute('data-workout-stage', 'exercise');
  await page.locator('[data-css-module-scope="workout-stage-action-panel"]').getByRole('button', { name: /Следующее|Завершить|Итоги/ }).click();
  await expect(page.getByTestId('workout-finish-screen')).toBeVisible();
  await readableStats(page);
  await expect(page.getByLabel('Комментарий тренеру')).toHaveValue('Без изменений');
  assertNoErrors();
});

test('WebKit finish summary keeps values and last content clear of its fixed action bar', async ({ baseURL }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'One WebKit check.');
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await isolateTelegramSdk(page);
    const assertNoErrors = failOnRuntimeErrors(page);
    await page.goto(url());
    await readableStats(page);
    await scrollToEnd(page);
    await page.getByLabel('Комментарий тренеру').fill('Проверка Safari');
    await page.screenshot({ path: info.outputPath('finish-webkit.png') });
    assertNoErrors();
  } finally { await browser.close(); }
});
