import { test, expect } from '@playwright/test';
import { failOnRuntimeErrors } from './runtime-errors.js';

async function assertPalette(page) {
  const leftovers = await page.evaluate(() => {
    const found = new Set();
    for (const el of document.querySelectorAll('.trainerNextRoot *, [data-trainer-modal-surface] *')) {
      if (!el.getClientRects().length) continue;
      const css = getComputedStyle(el);
      for (const prop of ['color', 'backgroundColor', 'borderTopColor', 'backgroundImage', 'boxShadow', 'stroke', 'fill']) {
        for (const match of (css[prop] || '').matchAll(/rgba?\((\d+), (\d+), (\d+)/g)) {
          const [r,g,b] = match.slice(1).map(Number);
          if (b > g + 6 && r > g + 3 && b > r + 3) found.add(`${el.tagName}.${el.getAttribute('class') || ''}: ${prop}=${css[prop]}`);
        }
      }
    }
    return [...found];
  });
  expect(leftovers, 'Legacy violet values in rendered trainer components').toEqual([]);
}
async function closePlan(page) {
  const close = page.locator('[data-trainer-modal-surface="true"] .trainerNextModalClose');
  if (await close.isVisible()) await close.click();
}
for (const width of [393,768,1366]) {
  test(`V2 nested client screens and sheets share the palette at ${width}px`, async ({page}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'Explicit viewport coverage runs once.');
    test.setTimeout(90000);
    page.setDefaultTimeout(10000);
    await page.setViewportSize({width,height:852});
    await page.emulateMedia({reducedMotion:'reduce'});
    const errors = failOnRuntimeErrors(page);
    await page.goto('/v2?trainerHarness=1');
    await expect(page.locator('#root .trainerNextRoot')).toBeVisible();
    const navigate = async section => {
      const mobile=page.getByTestId(`trainer-nav-${section}`);
      await (await mobile.isVisible()?mobile:page.getByTestId(`trainer-desktop-nav-${section}`)).click();
    };
    for (const section of ['dashboard','more','clients']) {
      await navigate(section);
      await assertPalette(page);
    }
    await page.locator('.trainerNextClientTable > button').first().click();
    await closePlan(page);
    for (const name of ['Сводка','Тренировки','Питание','Фото и замеры']) {
      const tabs=page.locator('.trainerNextClientTabs');
      await (await tabs.isVisible()?tabs:page.locator('.trainerNextClientMobileNav')).getByRole('button',{name,exact:true}).click();
      await closePlan(page);
      await assertPalette(page);
      const header=await page.locator('.trainerNextClientHeader').boundingBox();
      const root=await page.locator('#root .trainerNextRoot').first().boundingBox();
      expect(header.x).toBeGreaterThanOrEqual(root.x);
      expect(header.x + header.width).toBeLessThanOrEqual(root.x + root.width + 1);
      expect(header.width).toBeLessThanOrEqual(1004);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({path:`artifacts/trainer-complete-${width}-${name}.png`,animations:'disabled'});
    }
    const summaryTabs=page.locator('.trainerNextClientTabs');
    await (await summaryTabs.isVisible()?summaryTabs:page.locator('.trainerNextClientMobileNav')).getByRole('button',{name:'Сводка',exact:true}).click();
    // Open read-only utility sheets; no messages are sent and no client data is saved.
    for (const [button,title] of [['Задания клиенту','Задания клиенту'],['Сообщения Переписка с клиентом','Сообщения'],['Открыть абонемент клиента','Календарь тренировок']]) {
      await page.getByRole('button',{name:button === 'Задания клиенту' ? /^Задания клиенту/ : button,exact:button !== 'Задания клиенту'}).click();
      const dialog=page.getByRole('dialog',{name:title,exact:true});
      await expect(dialog).toBeVisible();
      await assertPalette(page);
      if (title === 'Календарь тренировок') {
        const marks = dialog.locator('.trainerNotificationLegend i');
        expect(await marks.allTextContents()).toEqual(['―','○','✓','↗','!','↪','✓']);
        for (const mark of await marks.all()) {
          expect(await mark.evaluate(el => getComputedStyle(el).textIndent)).toBe('0px');
          expect(await mark.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14);
        }
      }
      const box=await dialog.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x+box.width).toBeLessThanOrEqual(width+1);
      expect(box.height).toBeLessThanOrEqual(852);
      await page.screenshot({path:`artifacts/trainer-complete-${width}-${title}.png`,animations:'disabled'});
      await dialog.getByRole('button',{name:`Закрыть: ${title}`,exact:true}).click();
    }
    if (width === 393) {
      await page.getByRole('button',{name:'Назад к списку клиентов',exact:true}).click();
      await navigate('more');
      for (const name of ['Аналитика','Уведомления']) {
        await page.getByRole('button',{name:new RegExp('^'+name)}).click();
        const dialog=page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await assertPalette(page);
        await dialog.locator('.trainerNextModalClose').click();
      }
      await navigate('workouts');
      await page.locator('.trainerNextPageTabs').getByRole('button',{name:'Программы',exact:true}).click();
      await assertPalette(page);
      await page.getByRole('button',{name:'Редактировать',exact:true}).click();
      await expect(page.locator('[data-trainer-constructor]')).toBeVisible();
      await assertPalette(page);
      await page.getByRole('button',{name:/^День 1 Тренировка 1/}).click();
      await expect(page.getByLabel('Вес: Жим ногами',{exact:true})).toBeVisible();
      await assertPalette(page);
    }
    errors();
  });
}
