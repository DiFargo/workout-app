import { test, expect } from './app-test.js';

for (const width of [320, 393, 1366, 1920]) {
  test(`empty client layout and assignment failure at ${width}px`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'Explicit viewport matrix');
    await page.setViewportSize({ width, height: 900 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/v2?trainerHarness=1&sparsePreview=1&assignmentPreview=1');
    await page.locator('[data-testid="trainer-nav-clients"]:visible,[data-testid="trainer-desktop-nav-clients"]:visible').click();
    await page.locator('.trainerNextClientTable > button').first().click();
    const setup = page.getByRole('combobox', { name: 'Программа тренировок', exact: true });
    await expect(setup).toHaveValue('');
    await expect(setup.locator('option')).toHaveCount(2);
    await page.getByRole('button', { name: 'Закрыть настройку', exact: true }).click();
    await page.getByRole('button', { name: 'Закрыть мастер', exact: true }).click();
    const overview = await page.locator('.trainerNextClientOverview').boundingBox();
    const dynamics = page.getByTestId('trainer-client-progress-dashboard');
    await expect(dynamics).toBeVisible();
    const layout = await dynamics.evaluate(node => {
      const columns = node.parentElement;
      const css = getComputedStyle(columns);
      return {
        columns: css.gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length,
        gap: Number.parseFloat(css.columnGap),
        bounds: columns.getBoundingClientRect().toJSON(),
        dynamics: node.getBoundingClientRect().toJSON(),
        aside: columns.lastElementChild.getBoundingClientRect().toJSON()
      };
    });
    // Familiar sections use a 1.3fr / 1fr overview from 1000px; the
    // dynamics card fills its column, not the whole two-column overview.
    const wide = width >= 1000;
    expect(layout.columns).toBe(wide ? 2 : 1);
    expect(layout.gap).toBe(wide ? 20 : 18);
    expect(layout.bounds.width).toBeCloseTo(overview.width, 0);
    expect(layout.dynamics.width).toBeCloseTo(wide ? (layout.bounds.width - 20) * 1.3 / 2.3 : layout.bounds.width, 0);
    for (const bounds of [layout.bounds, layout.dynamics, layout.aside]) {
      expect(bounds.left).toBeGreaterThanOrEqual(overview.x);
      expect(bounds.right).toBeLessThanOrEqual(overview.x + overview.width + 1);
    }
    if (wide) expect(layout.dynamics.right + 20).toBeCloseTo(layout.aside.left, 0);
    else expect(layout.aside.top).toBeGreaterThanOrEqual(layout.dynamics.bottom + 18 - 1);
    expect(overview.x).toBeGreaterThanOrEqual(0);
    expect(overview.x + overview.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `artifacts/fix-750-summary-${width}.png` });
    await page.locator('.trainerNextClientTabs:visible,.trainerNextClientMobileNav:visible').getByRole('button', { name: 'Тренировки', exact: true }).click();
    const empty = page.locator('[class*="emptyProgram"]');
    const inset = await empty.evaluate(el => el.querySelector('h3').getBoundingClientRect().left - el.getBoundingClientRect().left);
    expect(inset).toBeGreaterThanOrEqual(14);
    await page.locator('.trainerClientAssignmentDisclosure > summary').click();
    const select = page.getByRole('combobox', { name: 'Назначить программу клиенту', exact: true });
    await expect(select).toHaveValue('');
    await expect(select.locator('option')).toHaveCount(3);
    expect(await select.locator('option').evaluateAll(options => options.map(option => option.value))).toEqual(['', '__without_program__', 'program_ready']);
    await expect(select.locator('option')).toHaveText(['Выберите программу', 'Без программы', 'Готовая программа']);
    await expect(page.getByRole('button', { name: 'Назначить', exact: true })).toBeDisabled();
    await page.screenshot({ path: `artifacts/fix-750-empty-${width}.png` });
    await select.selectOption('program_ready');
    await page.getByRole('button', { name: 'Назначить', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'Корректировка под клиента', exact: true });
    await expect(modal).toBeVisible();
    const blank = modal.locator('article').filter({ hasText: 'Разгибание рук на верхнем блоке' });
    await expect(blank).toContainText('План новой программы · рабочий вес не указан');
    await expect(blank).toContainText('Для поправки сначала укажите рабочие веса в программе.');
    await expect(blank.locator('input')).toHaveCount(0);
    await expect(modal.getByLabel('Поправка веса для упражнения Жим ногами', { exact: true })).toBeVisible();
    await expect(modal.locator('article').filter({ hasText: 'Скручивания' })).toContainText('Коррекция веса не нужна');
    const radius = await modal.evaluate(el => parseFloat(getComputedStyle(el).borderRadius));
    expect(radius).toBeGreaterThanOrEqual(20);
    await modal.getByRole('button', { name: 'Назначить программу', exact: true }).click();
    await expect(modal.getByRole('alert')).toHaveText('Сначала подготовьте программу к назначению.');
    await expect(modal.getByRole('alert')).toBeInViewport();
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Назначить программу', exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
    await page.screenshot({ path: `artifacts/fix-750-${width}.png` });
  });
}
