import { test, expect } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

async function navigate(page, section) {
  const mobile = page.getByTestId(`trainer-nav-${section}`);
  const control = await mobile.isVisible() ? mobile : page.getByTestId(`trainer-desktop-nav-${section}`);
  await control.click();
}

test.setTimeout(90000);

test("V2 is the reload-safe default at both trainer entry URLs", async ({ page }) => {
  const errors = failOnRuntimeErrors(page);
  await page.goto("/?trainerHarness=1", { waitUntil: "commit" });
  const root = page.locator(".trainerNextRoot");
  await expect(root).toBeVisible({timeout:40000});
  await expect(page.locator("html")).toHaveAttribute("data-trainer-variant", "v2");
  await expect(root).toHaveCSS("background-color", "rgb(245, 247, 248)");
  expect(await root.evaluate(el => getComputedStyle(el).getPropertyValue("--tn-purple-strong").trim())).toBe("#396ba6");
  const original = await root.evaluate(el => ({ background: getComputedStyle(el).backgroundColor, accent: getComputedStyle(el).getPropertyValue("--tn-purple-strong") }));
  await page.goto("/v2?trainerHarness=1");
  await expect(root).toBeVisible({timeout:40000});
  await expect(page.locator("html")).toHaveAttribute("data-trainer-variant", "v2");
  await expect(root).toHaveCSS("background-color", "rgb(245, 247, 248)");
  expect(await root.evaluate(el => getComputedStyle(el).getPropertyValue("--tn-purple-strong").trim())).toBe("#396ba6");
  await page.reload();
  await expect(root).toBeVisible({timeout:40000});
  await expect(page.locator("html")).toHaveAttribute("data-trainer-variant", "v2");
  for (const section of ["clients", "more", "workouts", "dashboard"]) {
    await navigate(page, section);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width + 1);
    await expect(root).toBeVisible({timeout:40000});
  }
  await page.screenshot({path:`artifacts/trainer-v2-${test.info().project.name}.png`, fullPage:true});
  await page.goto("/?trainerHarness=1");
  await expect(root).toBeVisible({timeout:40000});
  await expect(page.locator("html")).toHaveAttribute("data-trainer-variant", "v2");
  expect(await root.evaluate(el => ({ background: getComputedStyle(el).backgroundColor, accent: getComputedStyle(el).getPropertyValue("--tn-purple-strong") }))).toEqual(original);
  await page.reload();
  await expect(root).toBeVisible({timeout:40000});
  await expect(page.locator("html")).toHaveAttribute("data-trainer-variant", "v2");
  errors();
});

for (const path of ["/", "/v2"]) {
  test(`trainer card and program constructor remain usable at ${path}`, async ({ page }) => {
    const errors = failOnRuntimeErrors(page);
    await page.goto(`${path}?trainerHarness=1`, { waitUntil: "commit" });
    await expect(page.locator(".trainerNextRoot")).toBeVisible({timeout:40000});
    await navigate(page, "clients");
    await page.locator(".trainerNextClientTable > button").first().click();
    const nutritionSheet = page.locator("[data-trainer-modal-surface='true']").filter({has:page.locator("#trainer-nutrition-plan-modal-title")});
    if (await nutritionSheet.isVisible()) await nutritionSheet.locator(".trainerNextModalClose").click();
    for (const name of ["Сводка", "Тренировки", "Питание", "Фото и замеры"]) {
      const tabs = page.locator(".trainerNextClientTabs");
      const nav = await tabs.isVisible() ? tabs : page.locator(".trainerNextClientMobileNav");
      await nav.getByRole("button", {name, exact:true}).click();
      if (await nutritionSheet.isVisible()) await nutritionSheet.locator(".trainerNextModalClose").click();
      await expect(page.getByRole("heading", {name:"Germes", exact:true})).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width + 1);
    }
    await page.screenshot({path:`artifacts/trainer-card-${path === "/v2" ? "v2" : "default"}-${test.info().project.name}.png`});
    await page.getByRole("button", {name:"Действия с клиентом", exact:true}).click();
    await expect(page.locator(".trainerClientActionSheet")).toBeVisible();
    await page.locator(".trainerClientActionSheet header button").click();
    await page.getByRole("button", {name:"Назад к списку клиентов", exact:true}).click();
    await navigate(page, "more");
    await expect(page.locator(".trainerNextCabinetPage")).toBeVisible();
    await navigate(page, "workouts");
    await page.locator(".trainerNextPageTabs").getByRole("button", {name:"Программы",exact:true}).click();
    await expect(page.getByRole("searchbox", {name:"Найти программу"})).toBeVisible();
    await page.getByRole("button", {name:"Редактировать",exact:true}).click();
    await expect(page.locator("[data-trainer-constructor]")).toBeVisible();
    const day = page.getByRole("combobox", {name:"День программы",exact:true});
    const useDaySelect = await day.isVisible();
    if (!useDaySelect) await expect(page.getByRole("button", {name:"Тренировка 1 2 упр.",exact:true})).toBeVisible();
    await expect(page.getByRole("main", {name:"День 1 из 3",exact:true})).toBeVisible();
    await expect(page.getByLabel("Вес: Жим ногами", {exact:true})).toBeVisible();
    const exerciseName = page.getByRole("button", {name:"Жим ногами Ноги и ягодицы",exact:true});
    expect((await exerciseName.boundingBox()).width).toBeGreaterThanOrEqual(100);
    // The isolated harness supplies no-op persistence callbacks; verify controls and navigation.
    await expect(page.getByLabel("Вес: Жим ногами", {exact:true})).toBeEditable();
    await expect(page.getByLabel("Вес: Жим ногами", {exact:true})).toHaveValue("90");
    if (useDaySelect) await day.selectOption({label:"День 2 · Тренировка 2"});
    else await page.getByRole("button", {name:"Тренировка 2 1 упр.",exact:true}).click();
    await expect(page.getByRole("main", {name:"День 2 из 3",exact:true})).toBeVisible();
    if (useDaySelect) await day.selectOption({label:"День 1 · Тренировка 1"});
    else await page.getByRole("button", {name:"Тренировка 1 2 упр.",exact:true}).click();
    await expect(page.getByLabel("Вес: Жим ногами", {exact:true})).toHaveValue("90");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width + 1);
    await page.screenshot({path:`artifacts/trainer-constructor-${path === "/v2" ? "v2" : "default"}-${test.info().project.name}.png`});
    errors();
  });
}
