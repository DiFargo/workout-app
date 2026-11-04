import { test, expect } from './app-test.js';
import { failOnRuntimeErrors } from './runtime-errors.js';

for (const width of [320, 402, 760, 761, 768, 1024, 1366, 1920]) {
  test(`approved client workspace preserves tools at ${width}px`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'Explicit viewport coverage.');
    await page.setViewportSize({ width, height: 852 });
    const errors = failOnRuntimeErrors(page);
    await page.goto('/v2?trainerHarness=1&photoCompare=1');
    await expect(page.locator('#root .trainerNextRoot')).toBeVisible({ timeout: 40_000 });
    const mobile = page.getByTestId('trainer-nav-clients');
    await (await mobile.isVisible() ? mobile : page.getByTestId('trainer-desktop-nav-clients')).click();
    await page.locator('.trainerNextClientTable > button').first().click();
    async function tab(name) {
      const desktop = page.locator('.trainerNextClientTabs');
      await (await desktop.isVisible() ? desktop : page.locator('.trainerNextClientMobileNav')).getByRole('button', { name, exact: true }).click();
      const close = page.getByRole('button', { name: 'Закрыть редактор плана', exact: true });
      if (await close.isVisible()) await close.click();
    }
    for (const name of ['Сводка', 'Тренировки', 'Питание', 'Фото и замеры']) {
      await tab(name);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      const header = await page.locator('.trainerNextClientHeader').boundingBox();
      expect(header.height).toBeLessThan(width >= 761 ? 140 : 180);
      for (const child of await page.locator('.trainerNextClientHeader > *').all()) {
        const box = await child.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(header.x);
        expect(box.x + box.width).toBeLessThanOrEqual(header.x + header.width);
      }
      if (width <= 760) {
        await expect(page.locator('.trainerNextClientMobileNav')).toBeHidden();
        const dock = await page.locator('.trainerNextClientTabs').boundingBox();
        expect(dock.x).toBeGreaterThanOrEqual(0);
        expect(dock.x + dock.width).toBeLessThanOrEqual(width);
        expect(dock.y + dock.height).toBeLessThanOrEqual(852);
      }
      if (name === 'Сводка') {
        await expect(page.locator('.trainerNextClientHeader .trainerNextClientTaskButton')).toHaveCount(0);
        const metrics = await page.locator('.trainerClientWorkSummary').boundingBox();
        expect(metrics.height).toBeLessThan(width > 360 ? 150 : 260);

      }
      if (name === 'Тренировки') {
        await expect(page.locator('.trainerClientWorkoutList .trainerWorkoutCompleted')).toHaveCount(1);
        await expect(page.locator('.trainerClientWorkoutList details').first()).toContainText('Выполнена');

        await expect(page.locator('.trainerClientMainColumn > section').first().locator('.trainerClientWorkoutList')).toHaveCount(1);
        await expect(page.locator('.trainerClientWorkoutList')).not.toHaveAttribute('open');
        await expect(page.locator('.trainerClientWorkoutList > summary')).toBeVisible();
        await expect(page.locator('.trainerClientWorkoutList .trainerClientDisclosure > summary').first()).toBeHidden();
        await page.locator('.trainerClientWorkoutList > summary').click();
        await expect(page.locator('.trainerClientWorkoutList')).toHaveAttribute('open');
        await expect(page.locator('.trainerClientWorkoutList li').first()).toBeHidden();
        await expect(page.locator('.trainerClientWorkoutList .trainerClientDisclosure > summary').first()).toBeVisible();
        await expect(page.locator('.trainerWorkoutScheduleFooter')).toHaveCount(0);
        await page.locator('[class*=scheduleEditRow]').getByRole('button', { name: 'Редактировать', exact: true }).click();
        const calendarSheet = page.getByRole('dialog', { name: 'Расписание и абонемент', exact: true });
        await expect(calendarSheet).toBeVisible();
        await calendarSheet.getByRole('button', { name: 'Закрыть: Расписание и абонемент', exact: true }).click();

      }
      await page.screenshot({ fullPage: true, path: `artifacts/client-four-runtime-${width}-${name}.png` });
    }
    await expect(page.locator('.trainerPhotoCompareGrid figure')).toHaveCount(2);
    await expect(page.getByLabel('Первая фотосессия для сравнения')).toHaveValue('p1');
    await expect(page.getByLabel('Первая фотосессия для сравнения').locator('option[value="p2"]')).toHaveAttribute('disabled');
    await expect(page.getByLabel('Вторая фотосессия для сравнения')).toHaveValue('p2');
    await expect(page.locator('.trainerPhotoCompareGrid figcaption').first()).toContainText('До · 1 июн.');
    await page.locator('.trainerPhotoCompareGrid button').first().click();
    await expect(page.getByRole('dialog', { name: 'Просмотр фото клиента' })).toBeVisible();
    await page.getByRole('dialog', { name: 'Просмотр фото клиента' }).getByRole('button', { name: 'Закрыть', exact: true }).click();
    await expect(page.locator('[class*=measurementList] > div')).toHaveCount(3);
    await page.getByRole('button', { name: 'Все 12 показателей' }).click();
    const measurementSheet = page.getByRole('dialog', { name: 'Все показатели', exact: true });
    await expect(measurementSheet).toBeVisible();
    await expect(measurementSheet.getByTestId('trainer-measurement-field')).toHaveCount(12);
    await expect(page.locator('#root [class*=measurementList] > div')).toHaveCount(3);
    await measurementSheet.getByRole('button', { name: 'Закрыть: Все показатели', exact: true }).click();
    await expect(measurementSheet).toBeHidden();
    await page.getByRole('button', { name: /^История замеров/ }).click();
    const measurementHistory = page.getByRole('dialog', { name: 'История замеров', exact: true });
    await expect(measurementHistory).toBeVisible();
    await expect(measurementHistory.getByTestId('trainer-measurements-modal')).toBeVisible();
    await measurementHistory.getByRole('button', { name: 'Закрыть: История замеров', exact: true }).click();
    await page.getByRole('button', { name: /^Графики и анализ/ }).click();
    const measurementTrend = page.getByRole('dialog', { name: 'Графики и анализ', exact: true });
    await expect(measurementTrend.getByRole('combobox', { name: 'Показатель динамики', exact: true })).toBeVisible();
    await measurementTrend.getByRole('button', { name: 'Закрыть: Графики и анализ', exact: true }).click();
    await expect(page.locator('#root [class*=measurementList] > div')).toHaveCount(3);
    await tab('Тренировки');
    await expect(page.getByRole('button', {name:'Календарь',exact:true})).toHaveCount(0);
    await page.getByRole('button', {name:/^История программ/}).click();
    const subscriptions = page.getByRole('dialog', {name:'История программ',exact:true});
    await expect(subscriptions.getByRole('region', {name:'История назначенных программ'})).toBeVisible();
    await subscriptions.getByRole('button',{name:'Закрыть: История программ'}).click();
    await page.getByRole('button', { name: /^История тренировок/ }).click();
    const historySheet = page.getByRole('dialog', { name: 'История тренировок', exact: true });
    await expect(historySheet.getByRole('region', {name:'Сохранённые тренировки клиента'})).toBeVisible();
    await expect(historySheet.locator('[data-workout-history-detail]')).toHaveCount(0);
    await historySheet.locator('button[data-workout-history-review="current"]').click();
    await expect(historySheet.locator('[data-workout-history-detail]')).toContainText('Тяжело идёт, немного уменьшал вес относительно программы.');
    await historySheet.getByRole('button', { name: 'Закрыть: История тренировок', exact: true }).click();
    const assign = page.getByLabel('Назначить программу клиенту');
    await expect(assign).toBeHidden();
    await page.locator('.trainerClientAssignmentDisclosure > summary').click();
    await expect(assign).toBeVisible();
    await page.locator('.trainerClientAssignmentDisclosure > summary').click();
    if (await page.locator('.trainerClientWorkoutList').getAttribute('open') === null) await page.locator('.trainerClientWorkoutList > summary').click();
    await page.locator('.trainerClientWorkoutList .trainerClientDisclosure > summary').first().click();
    expect(await page.locator('.trainerWorkoutRowLabel').first().evaluate(el => getComputedStyle(el).transform)).toBe('none');
    await expect(page.locator('.trainerClientWorkoutList')).toContainText('Результат тренировки');
    const exercise = page.locator('.trainerClientWorkoutList li details').first();
    await expect(exercise).not.toHaveAttribute('open');
    await exercise.locator('summary').click();
    await expect(exercise).toContainText('Подход');
    await expect(exercise).toContainText('Факт');
    await exercise.locator('summary').click();
    await page.screenshot({path: `artifacts/workout-inline-${width}.png`});
    await expect(page.locator('.trainerClientWorkoutList li').first()).toBeVisible();
    await page.getByRole('button', { name: 'Открыть тренировку', exact: true }).click();
    await expect(page.locator('.trainerClientProgramEditorModal')).toBeVisible();
    errors();
  });
}
