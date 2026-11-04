import { expect, test } from './app-test.js';
import { failOnRuntimeErrors } from './runtime-errors.js';

const setsUrl = '/cssV2?clientHarness=1&clientHarnessPage=exerciseSets&clientHarnessTheme=warm-light';

test.setTimeout(90_000);

async function openWorkoutHarness(page, url, ready = 'client-harness-exercise-sets') {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.getByTestId(ready)).toBeVisible({ timeout: 40_000 });
}

test('set confirmation is sequential, neutral until completed, and editing stays independent', async ({ page }, testInfo) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openWorkoutHarness(page, setsUrl);
  const rows = page.getByTestId('workout-exercise-set-row');
  const confirm = (index) => rows.nth(index).getByRole('button', { name: /Выполнить подход|Подход .* выполнен/ });
  await expect(confirm(0)).toBeEnabled();
  await expect(confirm(1)).toBeDisabled();
  await expect(confirm(2)).toBeDisabled();
  expect(await confirm(0).evaluate(node => getComputedStyle(node, '::before').backgroundColor)).toBe('rgb(237, 241, 243)');
  await expect(confirm(0)).toHaveCSS('width', '48px');
  await rows.nth(2).locator('strong').first().click();
  await expect(confirm(2)).toHaveAttribute('aria-pressed', 'false');

  await rows.nth(2).getByRole('button', { name: 'Изменить подход 3' }).click();
  const editor = page.getByTestId('workout-set-edit-modal');
  await expect(editor).toBeVisible();
  await editor.locator(':scope > button').click();
  await expect(confirm(2)).toHaveAttribute('aria-pressed', 'false');

  for (let index = 0; index < 3; index += 1) {
    await confirm(index).click();
    await expect(confirm(index)).toHaveAttribute('aria-pressed', 'true');
    expect(await confirm(index).evaluate(node => getComputedStyle(node, '::before').backgroundImage)).toContain('linear-gradient');
    await expect(confirm(index)).toHaveCSS('color', 'rgb(255, 255, 255)');
    if (index < 2) await expect(confirm(index + 1)).toBeEnabled();
  }
  await expect(confirm(0)).toBeDisabled();
  await expect(confirm(1)).toBeDisabled();
  await rows.nth(0).locator('strong').first().click();
  await expect(confirm(0)).toHaveAttribute('aria-pressed', 'true');
  await confirm(2).click();
  await expect(confirm(2)).toHaveAttribute('aria-pressed', 'false');
  await expect(confirm(1)).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('ordered-sets.png') });
  assertNoErrors();
});

test('timed sets cannot start ahead of their turn and unlock after timer completion', async ({ page }) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  // This component fixture does not authenticate. Advancing its clock must
  // not race an unrelated live Google Auth script's delayed load callback.
  await page.route('https://apis.google.com/js/api.js*', route => route.fulfill({
    status: 200, contentType: 'application/javascript', body: '/* Authentication is outside this timer fixture. */'
  }));
  await page.clock.install();
  await openWorkoutHarness(page, `${setsUrl}&clientExerciseSetsState=timed`);
  const timers = page.getByTestId('workout-timed-set-timer');
  await expect(timers.nth(0)).toBeEnabled();
  await expect(timers.nth(1)).toBeDisabled();
  await timers.nth(0).click();
  await expect(timers.nth(0)).toHaveAttribute('data-running', 'true');
  await page.clock.fastForward(31_000);
  await expect(page.getByRole('button', { name: 'Подход 1 выполнен' })).toHaveAttribute('aria-pressed', 'true');
  await expect(timers.nth(0)).toBeDisabled();
  await expect(timers.nth(1)).toBeEnabled();
  await expect(timers.nth(2)).toBeDisabled();
  assertNoErrors();
});

test('single-set review and editing stay independent from the dynamic action and video', async ({ page }, testInfo) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openWorkoutHarness(page, '/cssV2?clientHarness=1&clientHarnessPage=workoutRunStage&clientWorkoutRunStage=exercise&clientHarnessTheme=warm-light', 'client-harness-workout-run-stage');
  const rows = page.getByTestId('workout-exercise-set-row');
  const selected = (index) => page.getByRole('button', { name: `Все подходы, выбран подход ${index} из 3` });
  const primary = page.getByTestId('workout-primary-action');
  const completedStatus = (index) => rows.getByRole('button', { name: `Подход ${index} выполнен, действия`, exact: true });
  const frame = page.getByTestId('workout-exercise-video-frame');
  const video = frame.locator('video');
  const restControl = page.getByTestId('workout-rest-timer-start');
  const expandedRest = page.getByTestId('workout-rest-timer-expanded');
  await expect(rows).toHaveCount(1);
  await expect(selected(2)).toBeVisible();
  await expect(selected(2)).toHaveAccessibleDescription('Выполнено 1 из 3');
  await expect(primary).toHaveAccessibleName('Подход выполнен');
  await expect(primary).toBeEnabled();
  await expect(page.getByRole('status').filter({ hasText: 'Выполнено 1 из 3' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Предыдущий подход', exact: true })).toHaveCount(0);
  await video.evaluate(node => { window.__workoutSetVideo = node; });
  let previousSize;
  let stableSamples = 0;
  await expect.poll(async () => {
    const current = await frame.boundingBox();
    stableSamples = previousSize && Math.max(Math.abs(current.width - previousSize.width), Math.abs(current.height - previousSize.height)) <= 0.5
      ? stableSamples + 1 : 0;
    previousSize = current;
    return stableSamples;
  }, { intervals: [50, 100, 100] }).toBeGreaterThanOrEqual(3);
  const settledFrameSize = await frame.boundingBox();
  const expectStableFrameSize = async () => {
    let matchingSamples = 0;
    await expect.poll(async () => {
      const current = await frame.boundingBox();
      const delta = Math.max(Math.abs(current.width - settledFrameSize.width), Math.abs(current.height - settledFrameSize.height));
      matchingSamples = delta <= 1 ? matchingSamples + 1 : 0;
      return matchingSamples;
    }, { intervals: [50, 100, 100] }).toBeGreaterThanOrEqual(3);
  };

  await restControl.click();
  await expect(restControl).toHaveAttribute('aria-label', 'Продолжить таймер отдыха');

  // A forward swipe must not bypass the pending approach or mark it completed.
  const start = await rows.locator('strong').first().boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2 - 82, { steps: 8 });
  await page.mouse.up();
  await expect(selected(2)).toBeVisible();
  await expect(primary).toHaveAccessibleName('Подход выполнен');
  await expect(completedStatus(2)).toHaveCount(0);
  await expect(expandedRest).toBeHidden();
  await expect.poll(() => video.evaluate(node => node === window.__workoutSetVideo)).toBe(true);
  await expectStableFrameSize();

  const returnStart = await rows.locator('strong').first().boundingBox();
  await page.mouse.move(returnStart.x + returnStart.width / 2, returnStart.y + returnStart.height / 2);
  await page.mouse.down();
  await page.mouse.move(returnStart.x + returnStart.width / 2, returnStart.y + returnStart.height / 2 + 82, { steps: 8 });
  await page.mouse.up();
  await expect(selected(1)).toBeVisible();
  await expect(completedStatus(1)).toBeVisible();
  await expectStableFrameSize();

  await selected(1).focus();
  await page.keyboard.press('ArrowDown');
  await expect(selected(2)).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(selected(2)).toBeFocused();
  await expect(completedStatus(2)).toHaveCount(0);
  await expect(expandedRest).toBeHidden();
  await expect.poll(() => video.evaluate(node => node === window.__workoutSetVideo)).toBe(true);
  await expectStableFrameSize();

  await rows.getByRole('button', { name: 'Изменить подход 2', exact: true }).click();
  const editor = page.getByTestId('workout-set-edit-modal');
  await editor.getByRole('listbox', { name: 'Вес, подход 2' }).getByRole('option', { name: '62.5', exact: true }).click();
  await editor.getByRole('listbox', { name: 'Повторы, подход 2' }).getByRole('option', { name: '12', exact: true }).click();
  await editor.getByRole('button', { name: 'Готово', exact: true }).click();
  await expect(rows).toContainText('62,5 кг');
  await expect(completedStatus(2)).toHaveCount(0);

  await selected(2).click();
  await expect(page.getByRole('button', { name: 'Перейти к подходу 3', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Перейти к подходу 1', exact: true }).click();
  await expect(selected(1)).toBeVisible();
  await expect(completedStatus(1)).toBeVisible();
  await selected(1).click();
  await page.getByRole('button', { name: 'Перейти к подходу 2', exact: true }).click();
  await expect(rows).toContainText('62,5 кг');
  await expect(rows).toContainText('12');
  await expect.poll(() => video.evaluate(node => node === window.__workoutSetVideo)).toBe(true);

  await primary.click();
  await expect(expandedRest).toBeVisible();
  await page.getByTestId('workout-rest-timer-minimize').click();
  await expect(primary).toHaveAccessibleName('Следующий подход');
  await expect(selected(2)).toBeVisible();
  await expect(expandedRest).toBeHidden();
  await page.getByRole('button', { name: 'Открыть таймер отдыха', exact: true }).click();
  await expect(expandedRest).toBeVisible();
  await page.getByTestId('workout-rest-timer-minimize').click();
  await expect(selected(2)).toBeVisible();
  await expect(completedStatus(2)).toBeVisible();
  await restControl.click();
  await completedStatus(2).click();
  await rows.getByRole('button', { name: 'Снять отметку выполнения подхода 2', exact: true }).click();
  await expect(expandedRest).toBeHidden();
  await expect(restControl).toHaveAttribute('aria-label', 'Запустить таймер отдыха');
  await expect(primary).toHaveAccessibleName('Подход выполнен');
  // Completion and advance are intentionally separate, deliberate actions.
  await page.waitForTimeout(420);
  await primary.click();
  await expect(expandedRest).toBeVisible();
  await page.getByTestId('workout-rest-timer-minimize').click();
  await expect(primary).toHaveAccessibleName('Следующий подход');
  await page.waitForTimeout(420);
  await primary.click();
  await expect(selected(3)).toBeVisible();
  await expect(primary).toHaveAccessibleName('Подход выполнен');
  await expect(completedStatus(3)).toHaveCount(0);
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('65 кг');
  await expect.poll(() => video.evaluate(node => node === window.__workoutSetVideo)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('runtime-single-ordered-set.png') });
  assertNoErrors();
});
