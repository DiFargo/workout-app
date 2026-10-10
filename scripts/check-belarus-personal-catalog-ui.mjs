import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {chromium} from 'playwright';
const out=path.resolve('output/belarus-products-10000');
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const context=await browser.newContext({viewport:{width:402,height:874},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const started=performance.now();await page.goto(pathToFileURL(path.join(out,'catalog.html')).href);
 await page.waitForFunction(()=>window.__catalogReady&&window.__lastSearch);
 const readyMs=performance.now()-started;
 await page.locator('#query').fill('савушкин творог 5%');
 await page.waitForFunction(()=>window.__lastSearch.query==='савушкин творог 5%');
 assert.ok(await page.locator('.food').count());
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:path.join(out,'preview-mobile.png'),fullPage:false});
 await page.locator('.food').first().click();assert.ok(await page.locator('#details').isVisible());
 await page.locator('#close-dialog').click();
 await page.locator('#query').fill('ndjhju');await page.waitForFunction(()=>window.__lastSearch.query==='ndjhju');assert.ok(await page.locator('.food').count());
 await page.locator('#filters').click();await page.locator('#source').selectOption('gemini');
 await page.waitForFunction(()=>[...document.querySelectorAll('.food')].every(el=>el.dataset.id.startsWith('gemini-')));
 await page.locator('.food').first().click();assert.ok(await page.locator('#portion').isHidden());await page.keyboard.press('Escape');
 await page.locator('#source').selectOption('');await page.locator('#query').fill('zzzzzzznoresult');
 await page.waitForFunction(()=>window.__lastSearch.query==='zzzzzzznoresult');assert.equal(await page.locator('.food').count(),0);
 await page.locator('#clear').click();await page.locator('#by').click();
 await page.waitForFunction(()=>window.__lastSearch.query===''&&window.__lastSearch.total===window.CATALOG.manifest.marketCounts.BY);
 await page.locator('#filters').click();
 // Exercise a warm offline catalogue with throttled CPU. Include result rendering, not just the worker.
 const session=await context.newCDPSession(page);await session.send('Emulation.setCPUThrottlingRate',{rate:4});
 await context.setOffline(true);await page.locator('#by').click();
 const timings=[];for(const q of ['творог','теос','гречка','молоко 2.5%','куриная грудка','экспонента','твроог','4810268031793']){
   await page.locator('#query').fill(q);await page.waitForFunction(q=>window.__lastSearch.query===q,q);timings.push(await page.evaluate(()=>window.__lastSearch));
 }
 await session.send('Emulation.setCPUThrottlingRate',{rate:1});await context.setOffline(false);
 await page.setViewportSize({width:1280,height:900});await page.locator('#query').fill('теос');await page.waitForFunction(()=>window.__lastSearch.query==='теос');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:path.join(out,'preview-desktop.png')});
 assert.deepEqual(errors,[]);
 const report={viewport:'iPhone 17 Pro, 402 × 874 CSS px',coldReadyMs:readyMs,cpuThrottle:4,offline:true,timings,errors};
 fs.writeFileSync(path.join(out,'browser-check.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
} finally {await browser.close()}
