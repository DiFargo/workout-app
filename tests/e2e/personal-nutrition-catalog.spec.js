import {test,expect} from './app-test.js';
import {readFileSync} from 'node:fs';

const catalogManifest=JSON.parse(readFileSync(new URL('../../src/data/nutrition-catalog/personalCatalogManifest.json',import.meta.url),'utf8'));
const catalogRequest=`**${catalogManifest.url}?v=${catalogManifest.hash}`;

test('worker search stays local, accepts typos, restores the cached catalogue offline and excludes quarantined Gemini foods',async({page},testInfo)=>{
  await page.setViewportSize({width:402,height:874});
  let apiCalls=0;
  let initialCatalogNetworkCalls=0;
  await page.route('**/api/nutrition/search?**',route=>{apiCalls++;return route.abort()});
  await page.route(catalogRequest,route=>{initialCatalogNetworkCalls++;return route.continue()});
  await page.goto('/tests/e2e/fixtures/gemini-search.html');
  const input=page.locator('#nutrition-food-search');
  await input.fill('савушкин творог 5%');
  const cards=page.locator('[data-food-search-result-card]');
  await expect(cards.first()).toBeVisible();
  expect(initialCatalogNetworkCalls).toBe(1);
  await expect(page.getByRole('button',{name:'Найти',exact:true})).toHaveCount(0);
  await page.screenshot({path:testInfo.outputPath('catalog-402.png'),fullPage:true});
  let catalogNetworkAfterReload=0;
  await page.unroute(catalogRequest);
  await page.route(catalogRequest,route=>{catalogNetworkAfterReload++;return route.abort()});
  await page.reload();await input.fill('творог');await expect(cards.first()).toBeVisible();
  expect(catalogNetworkAfterReload).toBe(0);
  await input.fill('ndjhju');await expect(cards.first()).toContainText(/творог|творож/i);
  // The recreated worker has read its data from CacheStorage; subsequent queries are offline.
  await page.context().setOffline(true);
  await input.fill('4810268031793');await expect(cards).toHaveCount(1);await expect(cards.first()).toContainText(/теос|teos/i);
  await page.context().setOffline(false);
  await input.fill('Кофейни Раф классический');
  // The archived gemini-25 has an unverified basis and must not re-enter search.
  await expect(page.getByText('Точного совпадения пока нет',{exact:true})).toBeVisible();
  await expect(cards).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('selected-food')).toHaveCount(0);
  expect(apiCalls).toBe(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('an allowed synthetic manufacturer fixture requires explicit nutrition-basis confirmation',async({page})=>{
  // Replace one search row only in this isolated response, preserving the worker
  // completeness check. The synthetic manufacturer/unknown pair is allowed by
  // the real quarantine policy; no archived Gemini food is restored.
  const catalog=JSON.parse(readFileSync(new URL(`../../public${catalogManifest.url}`,import.meta.url),'utf8'));
  catalog[0]=['synthetic-basis-confirmation','Синтетический напиток без единицы КБЖУ','Synthetic fixture manufacturer','Тестовый напиток',270,4,16,27,'unknown',[],[],'unknown','manufacturer',false,null];
  let catalogCalls=0;
  let apiCalls=0;
  await page.route(catalogRequest,route=>{catalogCalls++;return route.fulfill({json:catalog})});
  await page.route('**/api/nutrition/search?**',route=>{apiCalls++;return route.abort()});
  await page.goto('/tests/e2e/fixtures/gemini-search.html');
  await page.locator('#nutrition-food-search').fill('Синтетический напиток');
  const cards=page.locator('[data-food-search-result-card]');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('Нужно уточнить массу или объём КБЖУ');
  await cards.first().click();
  const dialog=page.getByRole('dialog',{name:'К какому количеству относятся КБЖУ?'});
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('selected-food')).toHaveCount(0);
  const confirm=dialog.getByRole('button',{name:'Использовать эти значения',exact:true});
  await dialog.getByLabel('Количество').fill('0');
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel('Количество').fill('200');
  await dialog.getByLabel('Единица').selectOption('ml');
  await confirm.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId('selected-food')).toHaveText('Синтетический напиток без единицы КБЖУ · 135 ккал');
  expect(catalogCalls).toBe(1);
  expect(apiCalls).toBe(0);
});

test('Gemini is requested explicitly and personal database stays available',async({page})=>{
  await page.route('**/src/utils/apiClient.js',route=>route.fulfill({contentType:'text/javascript',body:'export const fetchAuthorizedWithTimeout = (url, options) => fetch(url, options);'}));
  let calls=0;
  await page.route('**/api/nutrition/search?**',route=>{calls++;expect(new URL(route.request().url()).searchParams.get('provider')).toBe('gemini');return route.fulfill({json:{mode:'gemini',foods:[{id:'gemini-live-test',name:'Nutella дополнительный ответ',calories:539,protein:6.3,fat:30.9,carbs:57.5,sourceType:'gemini_search'}]}})});
  await page.goto('/tests/e2e/fixtures/gemini-search.html');
  await page.locator('#nutrition-food-search').fill('Nutella');
  await expect(page.locator('[data-food-search-result-card]').first()).toBeVisible();expect(calls).toBe(0);
  await page.getByRole('button',{name:'Поискать через Gemini'}).click();
  await expect(page.getByText('Nutella дополнительный ответ')).toBeVisible();expect(calls).toBe(1);
  await page.locator('#nutrition-food-search').fill('4810268031793');
  await expect(page.locator('[data-food-search-result-card]').first()).toContainText(/теос|teos/i);expect(calls).toBe(1);
  await page.getByRole('button',{name:'Мои продукты',exact:true}).click();
  await page.locator('#my-foods-search').fill('Nutella');await expect(page.getByText('Nutella из моей базы')).toBeVisible();
});
