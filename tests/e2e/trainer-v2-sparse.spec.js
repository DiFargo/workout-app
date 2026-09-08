import { test, expect } from '@playwright/test';

for (const width of [320, 393, 768, 1024, 1366]) {
  test(`sparse client is usable at ${width}px`, async ({page}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'Explicit viewports.');
    await page.setViewportSize({width,height:900});
    await page.goto('/v2?trainerHarness=1&sparsePreview=1');
    await expect(page.locator('#root .trainerNextRoot')).toBeVisible();
    const mobile=page.getByTestId('trainer-nav-clients');
    await (await mobile.isVisible()?mobile:page.getByTestId('trainer-desktop-nav-clients')).click();
    await page.locator('.trainerNextClientTable > button').first().click();
    await page.getByRole('button',{name:'Закрыть настройку',exact:true}).click();
    await page.getByRole('button',{name:'Закрыть мастер',exact:true}).click();
    for (const label of await page.locator('.trainerNextClientHeaderActions button span').all()) {
      if (!await label.isVisible()) continue;
      expect(await label.evaluate(el => {
        const text = el.getBoundingClientRect();
        const button = el.closest('button').getBoundingClientRect();
        return text.left >= button.left && text.right <= button.right + 1;
      })).toBe(true);
    }
    for (const name of ['Сводка','Тренировки','Питание','Фото и замеры']) {
      const top=page.locator('.trainerNextClientTabs');
      await (await top.isVisible()?top:page.locator('.trainerNextClientMobileNav')).getByRole('button',{name,exact:true}).click();
      const close=page.getByRole('button',{name:'Закрыть редактор плана',exact:true});
      if (await close.isVisible()) await close.click();
      if(name==='Сводка') await expect(page.getByText(/Одна запись за период/)).toBeVisible();
      if(name==='Тренировки') {
        await expect(page.getByText('Нет активной программы',{exact:true})).toBeVisible();
        await page.getByRole('button', { name: 'Календарь', exact: true }).click();
        const footer=page.locator('.trainerWorkoutScheduleFooter');
        await footer.scrollIntoViewIfNeeded();
        const collision=await page.locator('.trainerWorkoutScheduleSection').evaluate(el=>{
          const text=el.querySelector('.trainerWorkoutScheduleContent').getBoundingClientRect();
          const controls=el.querySelector('.trainerWorkoutScheduleControls').getBoundingClientRect();
          return controls.top < text.bottom - 1;
        });
        expect(collision).toBe(false);
        await page.getByRole('button', {name: 'Закрыть: Расписание и абонемент', exact: true}).click();
      }
      if(name==='Питание') {
        const bar=page.locator('.trainerClientBarChart i').first();
        await expect(bar).toBeVisible();
        expect((await bar.boundingBox()).width).toBeLessThanOrEqual(42);
      }
      if(name==='Фото и замеры') await expect(page.getByRole('heading',{name:'Фото пока нет'})).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({path:`artifacts/trainer-sparse-${width}-${name}.png`});
    }
  });
}
