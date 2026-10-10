import { test, expect } from "./app-test.js";

test("Gemini search waits for submit, excludes catalogs, shows sources and permits retry", async ({page}, testInfo) => {
  await page.route("**/src/utils/nutritionSearchMode.js", route=>route.fulfill({contentType:"text/javascript",body:"export const GEMINI_ONLY_FOOD_SEARCH = true;"}));
  await page.setViewportSize({width:393,height:852});
  await page.route("**/src/utils/apiClient.js", (route) => route.fulfill({contentType:"text/javascript",body:"export const fetchAuthorizedWithTimeout = (url, options) => fetch(url, options);"}));
  let requests = 0;
  await page.route("**/api/nutrition/search?**", async (route) => {
    requests++;
    expect(new URL(route.request().url()).searchParams.get("provider")).toBe("gemini");
    if (requests === 2) return route.fulfill({status:429,json:{message:"Gemini: исчерпан лимит запросов или баланс."}});
    return route.fulfill({json:{mode:"gemini",foods:[{id:"gemini_1",name:"Nutella Gemini",calories:539,protein:6.3,fat:30.9,carbs:57.5,sourceType:"gemini_search",sources:[{title:"nutella.com",url:"https://nutella.com/nutrition"}]}],searchSuggestions:"<a href='https://google.com/search?q=nutella' target='_blank'>Google Search</a>"}});
  });
  await page.goto("/tests/e2e/fixtures/gemini-search.html");
  const input = page.locator("#nutrition-food-search");
  await input.fill("Nutella");
  await expect(page.getByRole("button",{name:"Найти",exact:true})).toBeEnabled();
  expect(requests).toBe(0);
  await page.getByRole("button",{name:"Найти",exact:true}).click();
  await expect(page.locator("[data-food-search-result-card]")).toHaveCount(1);
  await expect(page.getByText("Nutella из моей базы")).toHaveCount(0);
  await expect(page.getByRole("link",{name:"Источник: nutella.com"})).toHaveAttribute("href","https://nutella.com/nutrition");
  await expect(page.locator("iframe[title='Поисковые подсказки Google']")).toBeVisible();
  await page.locator("[data-food-search-result-card]").click();
  await expect(page.getByTestId("selected-food")).toContainText("539 ккал");
  await page.screenshot({path:testInfo.outputPath("gemini-search-mobile.png"),fullPage:true});
  await page.getByRole("button",{name:"Найти",exact:true}).click();
  await expect(page.locator("[data-food-search-status=error]")).toContainText("исчерпан лимит");
  await expect(page.locator("[data-food-search-result-card]")).toHaveCount(0);
  await page.getByRole("button",{name:"Найти",exact:true}).click();
  await expect(page.locator("[data-food-search-result-card]")).toHaveCount(1);
  expect(requests).toBe(3);
  await page.getByRole("button",{name:"Мои продукты",exact:true}).click();
  await expect(page.getByText("Nutella из моей базы")).toBeVisible();
});

test("catalog search is automatic in the existing mobile nutrition screen", async ({page}, testInfo) => {
  await page.setViewportSize({width:393,height:852});
  await page.goto("/?clientHarness=1");
  await page.getByTestId("client-nav-nutrition").click();
  await page.getByTestId("nutrition-orbit-add").click();
  await page.locator("#nutrition-food-search").fill("Nutella");
  await expect(page.getByRole("button",{name:"Найти",exact:true})).toHaveCount(0);
  const button = page.getByRole("button",{name:"Поискать через Gemini",exact:true});
  await expect(button).toBeVisible();
  const box = await button.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator("[data-food-search-result-card]").first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath("gemini-search-app-mobile.png"),fullPage:true});
});
