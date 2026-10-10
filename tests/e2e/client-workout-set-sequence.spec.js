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
  await expect(confirm(0)).toHaveCSS('background-color', 'rgb(237, 241, 243)');
  await expect(confirm(0)).toHaveCSS('width', '52px');
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
    await expect(confirm(index)).toHaveCSS('background-color', 'rgb(35, 122, 66)');
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

test('runtime rejects a skipped set and starts rest only on an ordered confirmation', async ({ page }, testInfo) => {
  const assertNoErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openWorkoutHarness(page, '/cssV2?clientHarness=1&clientHarnessPage=workoutRunStage&clientWorkoutRunStage=exercise&clientHarnessTheme=warm-light', 'client-harness-workout-run-stage');
  const rows = page.getByTestId('workout-exercise-set-row');
  const restControl = page.getByTestId('workout-rest-timer-start');
  const expandedRest = page.getByTestId('workout-rest-timer-expanded');
  await restControl.click();
  await expect(restControl).toHaveAttribute('aria-label', 'Продолжить таймер отдыха');
  await rows.nth(2).locator('strong').first().click();
  await expect(expandedRest).toBeHidden();
  await expect(rows.nth(2).getByRole('button', { name: 'Выполнить подход 3' })).toBeDisabled();
  await rows.nth(1).getByRole('button', { name: 'Выполнить подход 2' }).click();
  await expect(expandedRest).toBeVisible();
  await page.getByTestId('workout-rest-timer-minimize').click();
  await restControl.click();
  await rows.nth(1).getByRole('button', { name: 'Подход 2 выполнен' }).click();
  await expect(expandedRest).toBeHidden();
  await expect(restControl).toHaveAttribute('aria-label', 'Продолжить таймер отдыха');
  await expect(rows.nth(2).getByRole('button', { name: 'Выполнить подход 3' })).toBeDisabled();
  await expect(rows.nth(1)).toContainText('60 кг');
  await expect(rows).toHaveCount(3);
  await page.screenshot({ path: testInfo.outputPath('runtime-ordered-sets.png') });
  assertNoErrors();
});
