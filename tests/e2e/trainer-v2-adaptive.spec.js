import { test, expect } from './app-test.js';
import { failOnRuntimeErrors } from './runtime-errors.js';

test.setTimeout(90000);
async function nav(page, section) {
  const mobile = page.getByTestId(`trainer-nav-${section}`);
  const control = await mobile.isVisible() ? mobile : page.getByTestId(`trainer-desktop-nav-${section}`);
  await control.click();
  await expect(control).toHaveAttribute('aria-current', 'page');
}
async function geometry(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.trainerNextRoot');
    const bar = [...root.querySelectorAll('.trainerNextMobileNav,.trainerNextDesktopDock')].find(el => el.getBoundingClientRect().height);
    const main = root.querySelector('.trainerNextMain');
    const r=root.getBoundingClientRect(), b=bar.getBoundingClientRect(), m=main.getBoundingClientRect(), c=main.firstElementChild.getBoundingClientRect();
    return {
      rootX:r.x,rootY:r.y,rootWidth:r.width,rootBottom:r.bottom,
      mainX:m.x,mainWidth:m.width,contentLeft:c.left,contentRight:c.right,
      navX:b.x,navY:b.y,navWidth:b.width,navHeight:b.height,navBottom:b.bottom,
      destinations:[...bar.querySelectorAll(':scope > button')].map(button=>button.dataset.section),
      targets:[...bar.querySelectorAll(':scope > button')].map(button=>button.getBoundingClientRect().toJSON()),
      overflow:document.documentElement.scrollWidth-innerWidth
    };
  });
}
for (const [width,height] of [[320,740],[375,844],[430,932],[600,900],[768,1024],[1024,900],[1366,900],[844,390]]) {
  test(`floating trainer dock and full-width content fit ${width}x${height}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium','Each explicit viewport runs once.');
    await page.setViewportSize({width,height});
    await page.emulateMedia({reducedMotion:'reduce'});
    const errors=failOnRuntimeErrors(page);
    await page.clock.setFixedTime(new Date('2026-06-17T12:00:00Z'));
    await page.goto('/v2?trainerHarness=1&layoutPreview=1');
    await expect(page.locator('.trainerNextRoot')).toBeVisible({timeout:40000});
    const baseline=await geometry(page);
    // TrainerAppearance owns the floating dock; it no longer copies the
    // client's full-width 70px bar. These fixtures have zero safe-area insets.
    expect(baseline.navWidth).toBeCloseTo(Math.min(560,width-24),0);
    expect(baseline.navHeight).toBe(76);
    expect(height-baseline.navBottom).toBeCloseTo(12,0);
    for(const section of ['dashboard','clients','more','workouts','library']) {
      await nav(page,section);
      const content = section==='dashboard' ? page.locator('.trainerNextDashboard')
        : section==='clients' ? page.locator('.trainerNextClientsPage')
        : section==='more' ? page.locator('.trainerNextCabinetPage')
        : section==='workouts' ? page.getByRole('searchbox',{name:'Найти программу',exact:true})
        : page.getByRole('searchbox',{name:'Поиск упражнений',exact:true});
      await expect(content).toBeVisible();
      const g=await geometry(page);
      expect(g.overflow).toBeLessThanOrEqual(1);
      expect(g.rootX).toBeGreaterThanOrEqual(0);
      expect(g.rootX+g.rootWidth).toBeLessThanOrEqual(width);
      expect(g.mainX).toBeCloseTo(g.rootX,0);
      expect(g.mainWidth).toBeCloseTo(g.rootWidth,0);
      expect(g.contentLeft).toBeGreaterThanOrEqual(g.rootX);
      expect(g.contentRight).toBeLessThanOrEqual(g.rootX+g.rootWidth);
      expect(g.navX).toBeGreaterThan(g.rootX);
      expect(g.navX+g.navWidth).toBeLessThan(g.rootX+g.rootWidth);
      expect(g.navY).toBeGreaterThanOrEqual(g.rootY);
      expect(g.navBottom).toBeLessThanOrEqual(g.rootBottom);
      expect(g.navX+g.navWidth/2).toBeCloseTo(width/2,0);
      expect(g.destinations).toEqual(['dashboard','clients','workouts','library','more']);
      for(const target of g.targets) {
        expect(target.width).toBeGreaterThanOrEqual(44);
        expect(target.height).toBeGreaterThanOrEqual(44);
        expect(target.left).toBeGreaterThanOrEqual(g.navX);
        expect(target.right).toBeLessThanOrEqual(g.navX+g.navWidth);
        expect(target.top).toBeGreaterThanOrEqual(g.navY);
        expect(target.bottom).toBeLessThanOrEqual(g.navBottom);
      }
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
        const cards=page.getByTestId('trainer-program-overview-card').locator(':scope > button');
        await expect(cards).toHaveCount(2);
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
  const expand=page.getByRole('button',{name:'Показать ход синхронизации',exact:true});
  await expect(expand).toBeVisible({timeout:40000});
  await expect(page.getByRole('status',{name:'Синхронизация: 12%',exact:true})).toBeVisible();
  await expand.click();
  const dialog=page.getByRole('dialog',{name:'Обновляем рабочее пространство'});
  await expect(dialog).toBeVisible({timeout:40000});
  const background=dialog.getByRole('button',{name:'Продолжить в фоне',exact:true});
  await expect(background).toHaveCSS('background-image','linear-gradient(115deg, rgb(70, 123, 114) 0%, rgb(62, 116, 139) 54%, rgb(53, 101, 163) 100%)');
  await expect(background).toHaveCSS('color','rgb(255, 255, 255)');
  await page.screenshot({path:`artifacts/trainer-adaptive-sync-${test.info().project.name}.png`});
  await background.click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button',{name:'Показать ход синхронизации'})).toBeVisible();
});
