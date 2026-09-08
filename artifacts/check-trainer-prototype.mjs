import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const url='http://127.0.0.1:4182/trainer-workspace-prototype.html';
await page.goto(url);
assert.equal(await page.locator('[data-screen]').count(),9);
await page.screenshot({path:'artifacts/trainer-expanded-overview.png',fullPage:true});
const ids=await page.locator('#screen-picker option').evaluateAll(els=>els.map(e=>e.value).filter(Boolean));
assert.equal(ids.length,21);
const open=async id=>{await page.selectOption('#screen-picker',id);assert.equal(await page.locator('[data-screen]').count(),1)};
for(const width of [320,390,768,1440]){
 await page.setViewportSize({width,height:900});
 for(const id of ids){await open(id);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Page overflow ${id}/${width}`);assert.equal(await page.locator('.content').evaluate(el=>el.scrollWidth>el.clientWidth+1),false,`Content overflow ${id}/${width}`)}
}
await page.setViewportSize({width:390,height:900});
await open('clients');await page.locator('[data-search=clients]').fill('Анна');assert.equal(await page.locator('[data-client]:visible').count(),1);
await page.locator('[data-search=clients]').fill('НЕСУЩЕСТВУЮЩИЙ');assert(await page.locator('[data-client-empty]').isVisible());
await open('programs');await page.locator('[data-action="go:constructor"]').click();await page.locator('[data-action="workout:0"]').click();await page.locator('[data-action="exercise:0"]').click();
await page.locator('[name="weight-0"]').fill('14');await page.locator('[data-action=add-set]').click();assert.equal(await page.locator('.set-row').count(),4);assert.equal(await page.locator('[name="weight-0"]').inputValue(),'14');
await page.locator('[data-form=exercise] .action-bar button').click();assert(await page.locator('[data-screen=workout]').isVisible());
await page.locator('[data-action=save-program]').click();await page.locator('[data-action="exercise:0"]').click();assert.equal(await page.locator('[name="weight-0"]').inputValue(),'14');
await page.locator('summary').click();await page.locator('[name=rir]').fill('0');await page.locator('[name=speed]').fill('4.5');await page.locator('[name=failure]').check();await page.locator('[name=side]').selectOption('left');await page.locator('[data-form=exercise] .action-bar button').click();await page.locator('[data-action="exercise:0"]').click();await page.locator('summary').click();assert.equal(await page.locator('[name=rir]').inputValue(),'0');assert.equal(await page.locator('[name=speed]').inputValue(),'4.5');assert(await page.locator('[name=failure]').isChecked());assert.equal(await page.locator('[name=side]').inputValue(),'left');
await open('constructor');await page.locator('[data-action="week:1"]').click();await page.locator('[data-action="workout:0"]').click();await page.locator('[data-action="exercise:0"]').click();assert.equal(await page.locator('[name="weight-0"]').inputValue(),'12','Weeks must be independent');
await open('library');await page.locator('[data-search=library]').fill('Планка');assert.equal(await page.locator('[data-library-name]:visible').count(),1);await page.locator('[data-action="add-library:5"]').click();assert(await page.getByText('Планка',{exact:true}).isVisible());
await open('assignment');await page.locator('[name=client]').selectOption('1');await page.locator('[data-form=assignment] button.primary').click();assert(await page.locator('[data-screen=calendar]').isVisible());await page.locator('[data-action="date:10"]').click();assert.equal(await page.locator('[data-action="date:10"]').getAttribute('aria-pressed'),'true');
await open('cabinet');await page.locator('[data-action="modal:trainer-profile"]').first().click();await page.locator('dialog [name=name]').fill('Алексей');await page.locator('dialog button.primary').click();assert(await page.getByText('Алексей Ковалёв',{exact:true}).isVisible());
await page.locator('[data-action="go:connections"]').click();await page.locator('[data-action="modal:telegram"]').click();await page.keyboard.press('Escape');assert.equal(await page.locator('dialog').isVisible(),false);
await page.locator('[data-group=group-client]').click();assert.equal(await page.locator('[data-screen]').count(),9);
await page.locator('[data-group=group-cabinet]').click();assert.equal(await page.locator('[data-screen]').count(),4);
await open('messages');await page.locator('[data-action=process-message]').click();assert(await page.getByText('Нет сообщений, ожидающих ответа',{exact:true}).isVisible());await page.locator('[data-action="message-filter:all"]').click();assert(await page.locator('[data-message-card]').isVisible());
await open('workout');await page.locator('[data-action="modal:block"]').click();await page.locator('dialog [name=name]').fill('Кардио в конце');await page.locator('dialog [name=type]').selectOption('Интервалы');await page.locator('dialog .primary').click();assert(await page.getByText('Кардио в конце',{exact:true}).isVisible());
await open('exercise');await page.screenshot({path:'artifacts/trainer-expanded-exercise-mobile.png',fullPage:true});
await page.setViewportSize({width:1440,height:1100});await page.locator('[data-group=group-program]').click();await page.screenshot({path:'artifacts/trainer-expanded-constructor.png',fullPage:true});
assert.deepEqual(errors,[]);
console.log('PASS: 21 pages at 4 widths; no page/content overflow; search, empty states, independent weeks, sets, save, library, assignment, calendar, cabinet, Escape and gallery groups. No page errors.');
await browser.close();
