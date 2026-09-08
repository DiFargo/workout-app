import { test, expect } from '@playwright/test';
import { failOnRuntimeErrors } from './runtime-errors.js';

test.setTimeout(90000);
async function nav(page, section) {
  const mobile = page.getByTestId(`trainer-nav-${section}`);
  await (await mobile.isVisible() ? mobile : page.getByTestId(`trainer-desktop-nav-${section}`)).click();
}
async function geometry(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.trainerNextRoot');
    const bar = [...root.querySelectorAll('.trainerNextMobileNav,.trainerNextDesktopDock')].find(el => el.getBoundingClientRect().height);
    const r=root.getBoundingClientRect(), b=bar.getBoundingClientRect();
    return {rootX:r.x,rootWidth:r.width,navX:b.x,navY:b.y,navWidth:b.width,navHeight:b.height,overflow:document.documentElement.scrollWidth-innerWidth};
  });
}
for (const [width,height] of [[320,740],[375,844],[430,932],[600,900],[768,1024],[1024,900],[1366,900],[844,390]]) {
  test(`client geometry and trainer content fit ${width}x${height}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium','Each explicit viewport runs once.');
    await page.setViewportSize({width,height});
    await page.emulateMedia({reducedMotion:'reduce'});
    const errors=failOnRuntimeErrors(page);
    await page.goto('/?clientHarness=1&clientHarnessTheme=warm-light');
    await expect(page.getByTestId('client-bottom-nav')).toBeVisible({timeout:40000});
    const clientBar=await page.getByTestId('client-bottom-nav').boundingBox();
    await page.clock.setFixedTime(new Date('2026-06-17T12:00:00Z'));
    await page.goto('/v2?trainerHarness=1&layoutPreview=1');
    await expect(page.locator('.trainerNextRoot')).toBeVisible({timeout:40000});
    const baseline=await geometry(page);
    expect(baseline.navWidth).toBeCloseTo(clientBar.width,0);
    if(height>500) expect(baseline.navHeight).toBeCloseTo(clientBar.height,0);
    for(const section of ['dashboard','clients','more','workouts']) {
      await nav(page,section);
      if(section==='workouts') await page.locator('.trainerNextPageTabs').getByRole('button',{name:'Программы',exact:true}).click();
      const g=await geometry(page);
      expect(g.overflow).toBeLessThanOrEqual(1);
      expect(g.rootWidth).toBeCloseTo(g.navWidth,0);
      expect(g.navX).toBeCloseTo(g.rootX,0);
      for(const key of ['navWidth','navHeight','navY','navX']) expect(g[key]).toBeCloseTo(baseline[key],0);
      if(section==='clients') {
        const cards=page.locator('.trainerNextClientTable > button');
        await expect(cards).toHaveCount(6);
        for (const card of await cards.all()) {
          const box=await card.boundingBox();
          expect(box.x).toBeGreaterThanOrEqual(g.rootX);
          expect(box.x+box.width).toBeLessThanOrEqual(g.rootX+g.rootWidth);
        }
        if(width<700) expect((await cards.first().boundingBox()).height).toBeLessThan(230);
        await cards.last().scrollIntoViewIfNeeded();
        // Scroll the actual content owner completely; the last card must clear the fixed bar.
        await page.locator('.trainerNextMain').evaluate(el=>{el.scrollTop=el.scrollHeight;});
        expect((await cards.last().boundingBox()).y+(await cards.last().boundingBox()).height).toBeLessThanOrEqual(g.navY);
        const header=page.locator(width<700?'.trainerNextMobileHeader':'.trainerNextDesktopPageHead');
        const rootBox=await page.locator('.trainerNextRoot').boundingBox();
        expect((await header.boundingBox()).y).toBeCloseTo(rootBox.y,0);
      }
      if(section==='workouts') {
        const search=page.getByRole('searchbox',{name:'Найти программу'});
        await expect(search).toBeVisible();
        expect((await search.boundingBox()).width).toBeGreaterThanOrEqual(120);
        const cards=page.getByRole('button',{name:/Готовая тренировочная программа из библиотеки/});
        expect((await cards.first().boundingBox()).height).toBeLessThan(260);
      }
      await page.locator('.trainerNextMain').evaluate(el=>{el.scrollTop=0;});
      if([375,600,768,1366].includes(width)) await page.screenshot({path:`artifacts/trainer-adaptive-${width}-${section}.png`,animations:"disabled"});
    }
    errors();
  });
}

test('sync sheet uses the V2 palette and can continue in the background',async({page})=>{
  await page.goto('/v2?trainerHarness=1&syncPreview=1');
  const dialog=page.getByRole('dialog',{name:'Обновляем рабочее пространство'});
  await expect(dialog).toBeVisible({timeout:40000});
  const background=dialog.getByRole('button',{name:'Продолжить в фоне',exact:true});
  await expect(background).toHaveCSS('background-color','rgb(63, 115, 184)');
  await page.screenshot({path:`artifacts/trainer-adaptive-sync-${test.info().project.name}.png`});
  await background.click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button',{name:'Показать ход синхронизации'})).toBeVisible();
});
