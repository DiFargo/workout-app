import { test, expect } from '@playwright/test';
import { failOnRuntimeErrors } from './runtime-errors.js';

for (const width of [320, 393, 768, 1366]) {
  test(`approved client workspace preserves tools at ${width}px`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'Explicit viewport coverage.');
    await page.setViewportSize({ width, height: 852 });
    const errors = failOnRuntimeErrors(page);
    await page.goto('/v2?trainerHarness=1&photoCompare=1');
    await expect(page.locator('#root .trainerNextRoot')).toBeVisible();
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
      expect(header.height).toBeLessThan(width >= 980 ? 140 : 180);
      await page.screenshot({ path: `artifacts/client-four-runtime-${width}-${name}.png` });
    }
    await expect(page.locator('.trainerPhotoCompareGrid figure')).toHaveCount(2);
    await expect(page.getByLabel('Первая фотосессия для сравнения')).toHaveValue('p2');
    await page.getByLabel('Первая фотосессия для сравнения').selectOption('p1');
    await expect(page.locator('.trainerPhotoCompareGrid figcaption').first()).toContainText('1 июн.');
    await page.locator('.trainerPhotoCompareGrid button').first().click();
    await expect(page.getByRole('dialog', { name: 'Просмотр фото клиента' })).toBeVisible();
    await page.getByRole('dialog', { name: 'Просмотр фото клиента' }).getByRole('button', { name: 'Закрыть', exact: true }).click();
    await expect(page.locator('.trainerClientMeasurementTable tbody tr')).toHaveCount(4);
    await page.getByRole('button', { name: 'Все показатели · 12' }).click();
    await expect(page.locator('.trainerClientMeasurementTable tbody tr')).toHaveCount(12);
    await tab('Тренировки');
    const assign = page.getByLabel('Назначить программу клиенту');
    await expect(assign).toBeHidden();
    await page.locator('.trainerClientAssignmentDisclosure > summary').click();
    await expect(assign).toBeVisible();
    await page.locator('.trainerClientAssignmentDisclosure > summary').click();
    await page.locator('.trainerClientWorkoutList summary').first().click();
    await expect(page.locator('.trainerClientWorkoutList li').first()).toBeVisible();
    await page.getByRole('button', { name: 'Открыть тренировку', exact: true }).click();
    await expect(page.locator('.trainerClientProgramEditorModal')).toBeVisible();
    errors();
  });
}
