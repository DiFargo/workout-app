import { expect, test, webkit, isolateTelegramSdk } from './app-test.js';
import { failOnRuntimeErrors } from './runtime-errors.js';

const stageUrl = (stage) => `/cssV2?clientHarness=1&clientHarnessPage=workoutRunStage&clientWorkoutRunStage=${stage}&clientHarnessTheme=warm-light`;

test('portrait square video and the complete selected set fit above fixed controls without scrolling', async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(90_000);
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One mobile viewport matrix.');
  const context = await browser.newContext({ baseURL, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await isolateTelegramSdk(page);
  const cdp = await context.newCDPSession(page);
  const assertNoErrors = failOnRuntimeErrors(page);
  try {
    for (const profile of [
      { name: 'iphone-17-pro-fit', width: 402, height: 874, top: 62, bottom: 34 },
      { name: 'android-fit', width: 360, height: 740, top: 24, bottom: 24 },
      { name: 'android-tall-fit', width: 393, height: 780, top: 24, bottom: 24 },
      { name: 'small-phone-fit', width: 375, height: 667, top: 20, bottom: 0 },
      { name: 'narrow-phone-fit', width: 320, height: 640, top: 0, bottom: 24 },
      { name: 'telegram-compact', width: 338, height: 640, top: 0, bottom: 24 },
      { name: 'reference-fit', width: 447, height: 898, top: 0, bottom: 0 }
    ]) {
      await page.setViewportSize({ width: profile.width, height: profile.height });
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: profile.top, bottom: profile.bottom, left: 0, right: 0 } });
      await page.goto(stageUrl('exercise'));
      const card = page.getByTestId('workout-plan-card');
      const deck = page.getByTestId('workout-run-stage');
      await expect(deck).toBeVisible({ timeout: 40_000 });
      await expect(page.getByTestId('workout-exercise-set-row')).toHaveCount(1);
      await expect(page.getByRole('button', { name: 'Все подходы, выбран подход 2 из 3' })).toBeVisible();
      await expect.poll(() => deck.evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
      const frame = await page.getByTestId('workout-exercise-video-frame').boundingBox();
      const cardBox = await card.boundingBox();
      const deckBox = await deck.boundingBox();
      expect(frame.width / frame.height).toBeCloseTo(1, 2);
      expect(frame.width).toBeLessThanOrEqual(cardBox.width + 1);
      expect(frame.width / cardBox.width).toBeGreaterThanOrEqual(0.72);
      expect(frame.y).toBeGreaterThanOrEqual(deckBox.y - 1);
      const finalRow = await page.getByTestId('workout-exercise-set-row').last().boundingBox();
      const dock = await page.locator('[data-css-module-scope="workout-stage-action-panel"]').boundingBox();
      expect(finalRow.y + finalRow.height).toBeLessThanOrEqual(dock.y - 8);
      expect(frame.y + frame.height).toBeLessThanOrEqual(finalRow.y);
      expect(await deck.evaluate(el => el.scrollTop)).toBe(0);
      await page.screenshot({ path: testInfo.outputPath(`${profile.name}-whole-screen.png`) });
      await checkLayout(page, 'exercise');
      for (const control of await page.getByTestId('workout-exercise-set-row').last().getByRole('button').all()) {
        const box = await control.boundingBox();
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      await page.screenshot({ path: testInfo.outputPath(`${profile.name}.png`) });
    }
    assertNoErrors();
  } finally { await context.close(); }
});

async function checkLayout(page, stage) {
  const deck = page.getByTestId('workout-run-stage');
  const dock = page.locator('[data-css-module-scope="workout-stage-action-panel"], [data-testid="workout-finish-actions"]');
  await expect(deck).toBeVisible({ timeout: 40_000 });
  await expect.poll(async () => {
    const reserved = await page.locator('[data-css-module-scope="workout-run-page"]').evaluate(el => parseFloat(el.style.getPropertyValue('--workout-dock-height')));
    return Math.abs(reserved - (await dock.boundingBox()).height);
  }).toBeLessThanOrEqual(1);
  await deck.evaluate(el => { el.scrollTop = el.scrollHeight; });

  const content = stage === 'exercise' ? page.getByTestId('workout-plan-card')
    : stage === 'warmup' ? page.getByTestId('workout-stage-card') : page.getByTestId('workout-finish-card');
  const contentBox = await content.boundingBox();
  const dockBox = await dock.boundingBox();
  expect(contentBox.y + contentBox.height, `last ${stage} content is above dock`).toBeLessThanOrEqual(dockBox.y - 8);
  expect(dockBox.y + dockBox.height).toBeLessThanOrEqual(page.viewportSize().height + 1);
  expect(await deck.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

  for (const button of await dock.getByRole('button').all()) {
    const box = await button.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(48);
    expect(box.width).toBeGreaterThanOrEqual(48);
    const overflow = await button.evaluate(el => {
      const box = el.getBoundingClientRect();
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node;
      let outside = false;
      while ((node = walker.nextNode())) {
        if (!node.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (rect.left < box.left - 1 || rect.right > box.right + 1 || rect.top < box.top - 1 || rect.bottom > box.bottom + 1) outside = true;
        }
      }
      return outside;
    });
    expect(overflow, `button text fits: ${await button.innerText()}`).toBe(false);
  }
  if (stage === 'exercise' && await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize) === 16)) {
    // The one primary label must stay on one line at the normal text size.
    const primary = page.getByTestId('workout-primary-action');
    await expect(primary).toHaveCount(1);
    expect(await primary.evaluate(el => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let text;
      while ((text = walker.nextNode())) if (text.textContent.trim() === el.getAttribute('aria-label')) break;
      const range = document.createRange();
      range.selectNodeContents(text);
      return range.getClientRects().length;
    })).toBe(1);
  }
}

test('workout refits after resizing and exercise navigation without changing set values', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One resize and navigation regression.');
  test.setTimeout(90_000);
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto(stageUrl('exercise'));
  await expect(page.getByTestId('workout-run-stage')).toBeVisible({ timeout: 40_000 });
  const rows = page.getByTestId('workout-exercise-set-row');
  await expect(rows).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Все подходы, выбран подход 2 из 3' })).toBeVisible();
  const values = await rows.locator('strong').allTextContents();
  const video = page.getByTestId('workout-exercise-video-frame');
  const original = await video.boundingBox();
  await page.setViewportSize({ width: 360, height: 740 });
  await checkLayout(page, 'exercise');
  expect((await video.boundingBox()).height).toBeLessThan(original.height);
  const portraitSize = (await video.boundingBox()).width;
  await page.setViewportSize({ width: 360, height: 640 });
  await checkLayout(page, 'exercise');
  expect((await video.boundingBox()).width).toBeLessThan(portraitSize);
  expect(await page.getByTestId('workout-run-stage').evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
  // A longer exercise title uses the same real header and triggers a height reflow.
  await page.locator('[data-css-module-scope="workout-stage-heading"] > div > span').first().evaluate(el => {
    el.textContent = 'Тяга гантели с опорой на скамью';
  });
  await checkLayout(page, 'exercise');
  const primary = page.getByTestId('workout-primary-action');
  for (const label of ['Подход выполнен', 'Следующий подход', 'Подход выполнен', 'Следующее упражнение']) {
    await expect(primary).toHaveAccessibleName(label);
    await primary.click();
    if (label === 'Подход выполнен') {
      await expect(page.getByTestId('workout-rest-timer-expanded')).toBeVisible();
      await page.getByTestId('workout-rest-timer-minimize').click();
    }
    await page.waitForTimeout(420);
  }
  await expect(rows).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Все подходы, выбран подход 1 из 2' })).toBeVisible();
  await expect(page.getByTestId('workout-exercise-progress')).toContainText('2 из 2');
  await checkLayout(page, 'exercise');
  await page.getByRole('button', { name: 'Предыдущее упражнение', exact: true }).click();
  await expect(rows).toHaveCount(1);
  await page.getByRole('button', { name: 'Все подходы, выбран подход 3 из 3' }).click();
  await page.getByRole('button', { name: 'Перейти к подходу 2', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Все подходы, выбран подход 2 из 3' })).toBeVisible();
  expect(await rows.locator('strong').allTextContents()).toEqual(values);
  await checkLayout(page, 'exercise');
  assertNoErrors();
});

test('workout cycle adapts to iPhone and Android widths and enlarged text', async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One mobile-context matrix.');
  test.setTimeout(120_000);
  const profiles = [
    { name: 'iphone-17-pro', width: 402, height: 874, safe: { top: 62, bottom: 34, left: 0, right: 0 } },
    { name: 'android-compact', width: 360, height: 800, safe: { top: 24, bottom: 24, left: 0, right: 0 } },
    { name: 'narrow-phone', width: 320, height: 720, safe: { top: 0, bottom: 0, left: 0, right: 0 } },
    { name: 'landscape', width: 874, height: 402, safe: { top: 0, bottom: 21, left: 47, right: 47 } }
  ];
  const context = await browser.newContext({ baseURL, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await isolateTelegramSdk(page);
  const assertNoErrors = failOnRuntimeErrors(page);
  const cdp = await context.newCDPSession(page);
  try {
    for (const profile of profiles) {
      await page.setViewportSize({ width: profile.width, height: profile.height });
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: profile.safe });
      for (const stage of ['warmup', 'exercise', 'finish', 'saved']) {
        await page.goto(stageUrl(stage));
        await checkLayout(page, stage);
        if (stage === 'exercise') {
          await page.getByRole('button', { name: 'Выйти из тренировки' }).click({ trial: true });
          const frame = await page.getByTestId('workout-exercise-video-frame').boundingBox();
          expect(frame.width / frame.height).toBeCloseTo(1, 2);
          await expect(page.getByTestId('workout-exercise-set-row')).toHaveCount(1);
          for (const button of await page.getByTestId('workout-exercise-set-row').first().getByRole('button').all()) {
            const box = await button.boundingBox();
            expect(box.width).toBeGreaterThanOrEqual(44);
            expect(box.height).toBeGreaterThanOrEqual(44);
          }
          await page.getByTestId('workout-run-stage').evaluate(el => { el.scrollTop = 0; });
          await page.screenshot({ path: testInfo.outputPath(`${profile.name}.png`) });
        }
        // Root text scaling models a user's larger default web font without
        // shrinking the viewport, so rem-based controls must genuinely grow.
        if (profile.name !== 'landscape') {
          const setValue = stage === 'exercise' ? page.getByTestId('workout-exercise-set-row').first().locator('strong').first() : null;
          const originalSetFontSize = setValue ? await setValue.evaluate(el => parseFloat(getComputedStyle(el).fontSize)) : null;
          await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
          await checkLayout(page, stage);
          if (stage === 'exercise') {
            expect(await setValue.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(originalSetFontSize * 1.5);
          }
          await page.screenshot({ path: testInfo.outputPath(`${profile.name}-${stage}-large-text.png`) });
        }
      }
    }
    assertNoErrors();
  } finally {
    await context.close();
  }
});

test('WebKit enlarged workout text remains scrollable above the dock', async ({ baseURL }, testInfo) => {
  test.setTimeout(60_000);
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Run WebKit once.');
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage({ baseURL, viewport: { width: 402, height: 874 }, isMobile: true, hasTouch: true });
    await isolateTelegramSdk(page);
    const assertNoErrors = failOnRuntimeErrors(page);
    for (const stage of ['warmup', 'exercise', 'finish', 'saved']) {
      await page.goto(stageUrl(stage));
      if (stage === 'exercise') {
        await page.setViewportSize({ width: 338, height: 640 });
        const frame = await page.getByTestId('workout-exercise-video-frame').boundingBox();
        const plan = await page.getByTestId('workout-plan-card').boundingBox();
        expect(frame.width).toBeLessThanOrEqual(plan.width + 1);
        expect(frame.width / frame.height).toBeCloseTo(1, 2);
        await expect.poll(() => page.getByTestId('workout-run-stage').evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
        const row = await page.getByTestId('workout-exercise-set-row').boundingBox();
        const dock = await page.locator('[data-css-module-scope="workout-stage-action-panel"]').boundingBox();
        expect(row.y + row.height).toBeLessThanOrEqual(dock.y - 8);
        await checkLayout(page, stage);
        const sets = page.getByTestId('workout-exercise-set-row');
        await expect(sets).toHaveCount(1);
        const picker = page.getByRole('button', { name: 'Все подходы, выбран подход 2 из 3', exact: true });
        await picker.click();
        await expect(page.getByRole('button', { name: 'Перейти к подходу 3', exact: true })).toBeDisabled();
        await page.getByRole('button', { name: 'Перейти к подходу 1', exact: true }).click();
        await expect(sets.getByRole('button', { name: 'Подход 1 выполнен, действия', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Все подходы, выбран подход 1 из 3', exact: true }).click();
        await page.getByRole('button', { name: 'Перейти к подходу 2', exact: true }).click();
        await expect(page.getByTestId('workout-primary-action')).toHaveAccessibleName('Подход выполнен');
        await expect(sets.getByRole('button', { name: 'Подход 2 выполнен, действия', exact: true })).toHaveCount(0);
      }
      await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
      await checkLayout(page, stage);
    }
    assertNoErrors();
  } finally {
    await browser.close();
  }
});

test('enlarged set picker keeps exact values and sequential confirmation', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One editor regression.');
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/cssV2?clientHarness=1&clientHarnessPage=exerciseSets&clientHarnessTheme=warm-light');
  const rows = page.getByTestId('workout-exercise-set-row');
  await expect(rows).toHaveCount(3, { timeout: 20_000 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  await rows.first().getByRole('button', { name: 'Изменить подход 1' }).click();
  const modal = page.getByTestId('workout-set-edit-modal');
  const reps = modal.getByRole('listbox', { name: 'Повторы, подход 1' });
  const weight = modal.getByRole('listbox', { name: 'Вес, подход 1' });
  await expect(reps.getByRole('option', { name: '12', exact: true })).toHaveCSS('height', '84px');
  const initialWeightOptionCount = await weight.getByRole('option').count();
  await expect(weight.getByRole('option', { name: '60', exact: true })).toHaveCSS('scroll-snap-stop', 'normal');
  await weight.getByRole('option', { name: '80', exact: true }).click();
  await expect(weight.getByRole('option', { name: '80', exact: true })).toHaveAttribute('aria-selected', 'true');
  expect(await weight.getByRole('option').count()).toBe(initialWeightOptionCount);
  await weight.getByRole('option', { name: '80.5', exact: true }).click();
  await expect(weight.getByRole('option', { name: '80.5', exact: true })).toHaveAttribute('aria-selected', 'true');
  const expandedWeightOptionCount = await weight.getByRole('option').count();
  expect(expandedWeightOptionCount).toBe(initialWeightOptionCount + 80);
  await weight.getByRole('option', { name: '81', exact: true }).click();
  await expect(weight.getByRole('option', { name: '81', exact: true })).toHaveAttribute('aria-selected', 'true');
  expect(await weight.getByRole('option').count()).toBe(expandedWeightOptionCount);
  await page.waitForTimeout(220);
  await expect(weight.getByRole('option', { name: '81', exact: true })).toHaveAttribute('aria-selected', 'true');
  await weight.getByRole('option', { name: '65', exact: true }).click();
  await reps.getByRole('option', { name: '12', exact: true }).click();
  await expect(reps.getByRole('option', { name: '12', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(weight.getByRole('option', { name: '65', exact: true })).toHaveAttribute('aria-selected', 'true');
  await modal.getByRole('button', { name: 'Готово', exact: true }).click();
  await expect(modal).toBeHidden();
  await expect(rows.first()).toContainText('65 кг');
  await expect(rows.first()).toContainText('12');
  await expect(rows.nth(1).getByRole('button', { name: 'Выполнить подход 2' })).toBeDisabled();
  const completedButton = rows.first().locator('button[aria-pressed]');
  await completedButton.click();
  await expect(completedButton).toHaveAttribute('aria-pressed', 'true');
  const completedStyle = await completedButton.evaluate(button => {
    const buttonRect = button.getBoundingClientRect();
    const row = button.closest('[data-testid="workout-exercise-set-row"]');
    const rowRect = row.getBoundingClientRect();
    const rowStyle = getComputedStyle(row);
    return {
      rowRadius: rowStyle.borderRadius,
      rowShadow: rowStyle.boxShadow,
      rowPaddingRight: Number.parseFloat(rowStyle.paddingRight),
      hitTarget: buttonRect.width,
      centerOffsetX: Math.round(buttonRect.left + buttonRect.width / 2 - (rowRect.right - Number.parseFloat(rowStyle.paddingRight) - 24)),
      centerOffsetY: Math.round(buttonRect.top + buttonRect.height / 2 - (rowRect.top + rowRect.height / 2)),
      circle: getComputedStyle(button, '::before').width,
      circleBackground: getComputedStyle(button, '::before').backgroundImage,
      checkColor: getComputedStyle(button).color
    };
  });
  expect(completedStyle.rowRadius).toBe('18px');
  expect(completedStyle.rowShadow).toBe('none');
  expect(completedStyle.rowPaddingRight).toBe(4);
  expect(completedStyle.hitTarget).toBe(48);
  expect(completedStyle.centerOffsetX).toBe(0);
  expect(completedStyle.centerOffsetY).toBe(0);
  expect(completedStyle.circle).toBe('40px');
  expect(completedStyle.circleBackground).toContain('linear-gradient');
  expect(completedStyle.checkColor).toBe('rgb(255, 255, 255)');
  await expect(rows.nth(1).getByRole('button', { name: 'Выполнить подход 2' })).toBeEnabled();
  await expect(rows.nth(2).getByRole('button', { name: 'Выполнить подход 3' })).toBeDisabled();
});

test('finish comment remains reachable when the available viewport shrinks', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Layout check, not a native keyboard simulation.');
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(stageUrl('finish'));
  const comment = page.getByTestId('workout-finish-card').locator('textarea');
  await comment.fill('Комментарий после тренировки');
  await page.setViewportSize({ width: 360, height: 480 });
  await checkLayout(page, 'finish');
  await comment.scrollIntoViewIfNeeded();
  const commentBox = await comment.boundingBox();
  const dockBox = await page.getByTestId('workout-finish-actions').boundingBox();
  expect(commentBox.y + commentBox.height).toBeLessThanOrEqual(dockBox.y);
  await expect(comment).toHaveValue('Комментарий после тренировки');
});
