import {test,expect} from './app-test.js';

test('10k worker search stays local, accepts typos, restores cached catalogue offline and confirms ambiguous units',async({page},testInfo)=>{
  await page.setViewportSize({width:402,height:874});
  let apiCalls=0;
  await page.route('**/api/nutrition/search?**',route=>{apiCalls++;return route.abort()});
  await page.goto('/tests/e2e/fixtures/gemini-search.html');
  const input=page.locator('#nutrition-food-search');
  await input.fill('савушкин творог 5%');
  const cards=page.locator('[data-food-search-result-card]');
  await expect(cards.first()).toBeVisible();
  await expect(page.getByRole('button',{name:'Найти',exact:true})).toHaveCount(0);
  await page.screenshot({path:testInfo.outputPath('catalog-402.png'),fullPage:true});
  let catalogNetworkAfterReload=0;
  await page.route('**/nutrition-catalog/personal/products.json?**',route=>{catalogNetworkAfterReload++;return route.abort()});
  await page.reload();await input.fill('творог');await expect(cards.first()).toBeVisible();
  expect(catalogNetworkAfterReload).toBe(0);
  await input.fill('ndjhju');await expect(cards.first()).toContainText(/творог|творож/i);
  // The recreated worker has read its data from CacheStorage; subsequent queries are offline.
  await page.context().setOffline(true);
  await input.fill('4810268031793');await expect(cards).toHaveCount(1);await expect(cards.first()).toContainText(/теос|teos/i);
  await page.context().setOffline(false);
  await input.fill('Кофейни Раф классический');
  await expect(cards.first()).toBeVisible();await cards.first().click();
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  await expect(page.getByTestId('selected-food')).toHaveCount(0);
  await dialog.getByLabel('Количество').fill('100');await dialog.getByLabel('Единица').selectOption('ml');
  await dialog.getByRole('button',{name:'Использовать эти значения'}).click();
  await expect(page.getByTestId('selected-food')).toContainText('135 ккал');
  expect(apiCalls).toBe(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
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
