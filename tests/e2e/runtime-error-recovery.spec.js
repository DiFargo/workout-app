import {test,expect} from "./app-test.js";
test("runtime failure can be reported without console and retried on a phone",async({page},testInfo)=>{
  await page.setViewportSize({width:375,height:667});
  await page.goto("/tests/e2e/fixtures/runtime-error.html");
  await expect(page.getByRole("heading",{name:"Экран не загрузился"})).toBeVisible();
  await expect(page.getByText("открой консоль",{exact:false})).toHaveCount(0);
  const button=page.getByRole("button",{name:"Отправить отчёт администратору"});
  await button.click();await expect(page.getByRole("status")).toContainText("Не удалось подтвердить отправку");
  await button.click();await expect(page.getByRole("status")).toContainText("Отчёт отправлен администратору");
  await expect(page.getByRole("button",{name:"Отчёт отправлен",exact:true})).toBeDisabled();
  expect(await page.locator("#result").textContent()).toContain("exerciseKey");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath("runtime-error-phone.png")});
});
