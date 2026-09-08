import { test, expect } from "@playwright/test";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(60_000);

async function openSearch(page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?clientHarness=1&clientHarnessTheme=warm-light");
  await expect(page.getByTestId("client-nav-nutrition")).toBeVisible({ timeout: 40_000 });
  await page.getByTestId("client-nav-nutrition").click();
  await expect(page.getByTestId("nutrition-orbit-add")).toBeVisible();
  await page.getByTestId("nutrition-orbit-add").click();
  await expect(page.getByTestId("food-search-screen")).toBeVisible();
}

async function openProduct(page) {
  await openSearch(page);
  await page.getByTestId("food-search-input").locator("input").fill("yogurt");
  await page.locator("[data-food-search-result-card]").first().click();
  await expect(page.getByTestId("food-product-page")).toBeVisible();
}

async function openNew(page, type) {
  await openSearch(page);
  await page.getByTestId("food-search-my-products-action").click();
  await page.getByTestId("food-search-create-in-my").click();
  await page.getByTestId("nutrition-create-choice-option").nth(type === "dish" ? 1 : 0).click();
  await expect(page.getByTestId("food-edit-page")).toBeVisible();
}

async function verifyEditor(page, viewport, screenshotPath) {
  const editor = page.getByTestId("food-edit-page");
  const content = editor.locator('[data-food-edit-page-part="content"]');
  const actions = editor.locator('[data-food-edit-page-part="actions"]');
  const bounds = await editor.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(await content.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  expect(await editor.evaluate(node => node.scrollHeight <= node.clientHeight + 1)).toBe(true);
  const actionBox = await actions.boundingBox();
  expect(actionBox.height).toBeLessThanOrEqual(70);
  expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(viewport.height + 1);
  const controls = editor.locator("input:visible, textarea:visible, button:visible");
  for (const control of await controls.all()) {
    await control.scrollIntoViewIfNeeded();
    const box = await control.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    if (await content.evaluate((node, child) => node.contains(child), await control.elementHandle())) {
      expect(box.y + box.height).toBeLessThanOrEqual(actionBox.y + 1);
    }
    if (await control.evaluate(node => node.tagName === "INPUT" || node.tagName === "TEXTAREA")) {
      expect(await control.evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
    }
  }
  await content.evaluate(node => { node.scrollTop = 0; });
  if (screenshotPath) await page.screenshot({ path: screenshotPath });
}

test("add food reuses the product meal selector and preserves the selected meal", async ({ page }, testInfo) => {
  const checkErrors = failOnRuntimeErrors(page);
  const visualStyle = node => {
    const style = getComputedStyle(node);
    return ["height", "padding", "borderRadius", "fontSize", "fontWeight", "color", "backgroundColor"].map(key => style[key]);
  };
  for (const viewport of [{ width: 375, height: 667 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await openSearch(page);
    const header = page.getByTestId("food-search-header");
    const toggle = page.locator('[data-food-search-header-action="toggle-meal"]');
    const menu = page.getByTestId("food-search-meal-menu");
    expect(await header.evaluate(node => getComputedStyle(node).borderBottomWidth)).toBe("0px");
    const buttonStyle = await toggle.evaluate(visualStyle);
    if (viewport.width === 375) await page.screenshot({ path: testInfo.outputPath("add-food-meal-375.png") });
    let optionStyle;
    for (const id of ["breakfast", "lunch", "dinner", "snack"]) {
      await toggle.click();
      await expect(menu.locator("[data-food-search-meal]")).toHaveCount(4);
      const option = page.locator(`[data-food-search-meal="${id}"]`);
      const icon = await option.locator("span[aria-hidden]").textContent();
      const name = await option.locator("strong").textContent();
      if (id === "breakfast") optionStyle = await page.locator('[data-food-search-meal="lunch"]').evaluate(visualStyle);
      const menuBox = await menu.boundingBox();
      const toggleBox = await toggle.boundingBox();
      const sheetBox = await page.getByTestId("food-search-screen").boundingBox();
      expect(menuBox.y).toBeGreaterThanOrEqual(toggleBox.y + toggleBox.height);
      expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(sheetBox.y + sheetBox.height + 1);
      expect(menuBox.x).toBeGreaterThanOrEqual(sheetBox.x);
      expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(sheetBox.x + sheetBox.width);
      if (id === "breakfast" && viewport.width === 375) await page.screenshot({ path: testInfo.outputPath("add-food-meal-menu-375.png") });
      await option.click();
      await expect(toggle).toContainText(name);
      await expect(toggle.locator("span[aria-hidden]")).toHaveText(icon);
      await expect(menu).toBeHidden();
      await expect(toggle).toBeFocused();
    }
    await toggle.click();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(header).toBeVisible();
    await page.getByTestId("food-search-input").locator("input").fill("yogurt");
    await page.locator("[data-food-search-result-card]").first().click();
    const productToggle = page.locator('[data-food-product-header-action="toggle-meal"]');
    await expect(productToggle).toContainText("Перекус/Другое");
    expect(await productToggle.evaluate(visualStyle)).toEqual(buttonStyle);
    await productToggle.click();
    expect(await page.locator('[data-food-product-meal="breakfast"]').evaluate(visualStyle)).toEqual(optionStyle);
    await productToggle.click();
    await page.locator('[data-food-product-action="back"]').click();
    await expect(toggle).toContainText("Перекус/Другое");
    await page.getByTestId("food-search-my-products-action").click();
    await expect(header).toHaveAttribute("data-food-search-header-variant", "my-products");
    await expect(toggle).toContainText("Перекус/Другое");
    await toggle.click();
    await expect(menu).toBeVisible();
    await toggle.click();
    await expect(menu).toBeHidden();
    await page.locator('[data-food-search-header-action="close"]').click();
    await expect(page.getByTestId("food-search-screen")).toBeHidden();
  }
  checkErrors();
});

test("compact product keeps meal selection, portions, live macros and add action", async ({ page }, testInfo) => {
  const checkErrors = failOnRuntimeErrors(page);
  for (const viewport of [{ width: 375, height: 667 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await openProduct(page);
    const hero = page.getByTestId("food-product-hero");
    expect((await hero.boundingBox()).height).toBeLessThanOrEqual(96);
    const meal = page.locator('[data-food-product-header-action="toggle-meal"]');
    expect((await meal.boundingBox()).height).toBeGreaterThanOrEqual(44);
    const header = page.getByTestId("food-product-flow-header");
    expect(await header.evaluate(node => getComputedStyle(node).borderBottomWidth)).toBe("0px");
    for (const id of ["breakfast", "dinner", "snack", "lunch"]) {
      await meal.click();
      const options = page.locator("[data-food-product-meal]");
      await expect(options).toHaveCount(4);
      const option = page.locator(`[data-food-product-meal="${id}"]`);
      const icon = await option.locator("span[aria-hidden]").textContent();
      const name = await option.locator("strong").textContent();
      if (id === "breakfast" && viewport.width === 375) {
        await page.screenshot({ path: testInfo.outputPath("meal-menu-375.png") });
      }
      await option.click();
      await expect(meal).toContainText(name);
      await expect(meal.locator("span[aria-hidden]")).toHaveText(icon);
      await expect(meal).toBeFocused();
      const selection = meal.locator(":scope > span").nth(1);
      expect(await selection.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      const selectionBox = await selection.boundingBox();
      const mealBox = await meal.boundingBox();
      expect(Math.abs(selectionBox.x + selectionBox.width / 2 - mealBox.x - mealBox.width / 2)).toBeLessThanOrEqual(1);
    }
    await meal.click();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("food-product-meal-menu")).toBeHidden();
    await expect(page.getByTestId("food-product-page")).toBeVisible();
    await expect(meal).toBeFocused();
    await expect(meal).toContainText("Обед");
    const amount = page.getByLabel("Количество продукта");
    await amount.fill("100");
    const calories = page.getByTestId("food-product-macros").locator("strong").first();
    const per100 = Number(await calories.textContent());
    await amount.fill("250");
    await expect(calories).toHaveText(String(Math.round(per100 * 2.5)));
    await page.locator('[data-food-portion-action="toggle-menu"]').click();
    const menu = page.getByTestId("food-portion-menu");
    const menuBox = await menu.boundingBox();
    const portionToggleBox = await page.locator('[data-food-portion-action="toggle-menu"]').boundingBox();
    expect(Math.abs(menuBox.x - portionToggleBox.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(menuBox.width - portionToggleBox.width)).toBeLessThanOrEqual(1);
    expect(menuBox.y).toBeGreaterThanOrEqual(portionToggleBox.y + portionToggleBox.height);
    const amountBox = await page.getByTestId("food-product-amount").boundingBox();
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(amountBox.y);
    expect(menuBox.x).toBeGreaterThanOrEqual(0);
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width + 1);
    await page.locator('[data-food-portion-action="toggle-menu"]').focus();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(page.getByTestId("food-product-page")).toBeVisible();
    await page.locator('[data-food-portion-action="toggle-menu"]').click();
    await page.locator("[data-food-portion-unit]").first().click();
    await expect(page.getByLabel("Увеличить количество")).toBeVisible();
    const before = Number(await amount.inputValue());
    await page.getByLabel("Увеличить количество").click();
    expect(Number(await amount.inputValue())).toBeGreaterThan(before);
    await page.locator('[data-food-portion-action="grams"]').click();
    await expect(page.getByLabel("Увеличить количество")).toHaveCount(0);
    const bar = page.getByTestId("food-product-action-bar");
    const barBox = await bar.boundingBox();
    expect(barBox.height).toBeLessThanOrEqual(70);
    expect(barBox.y + barBox.height).toBeLessThanOrEqual(viewport.height + 1);
    await expect(page.getByTestId("food-product-note-card")).toContainText("Название, БЖУ и описание");
    expect(await hero.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    if (viewport.width === 375) await page.screenshot({ path: testInfo.outputPath("product-375.png") });
    await page.locator('[data-food-product-action="add"]').click();
    await expect(page.getByTestId("food-product-page")).toBeHidden();
  }
  checkErrors();
});

test("portion chooser shows each weight once and preserves named size choices", async ({ page }, testInfo) => {
  const checkErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 375, height: 667 });
  await openProduct(page);
  await page.locator('[data-food-product-action="edit-note"]').click();
  const editor = page.getByTestId("food-edit-page");
  await editor.getByLabel("Название продукта", { exact: true }).fill("Хлеб с отрубями");
  await editor.getByLabel("Иконка", { exact: true }).fill("🍞");
  await editor.getByTestId("food-edit-basic-portion").locator("input").fill("250");
  await page.locator('[data-food-edit-page-action="confirm"]').click();
  await page.locator('[data-food-portion-action="grams"]').click();
  const toggle = page.locator('[data-food-portion-action="toggle-menu"]');
  await toggle.click();
  const options = page.locator("[data-food-portion-unit]");
  await expect(options).toHaveCount(1);
  await expect(options.first()).toHaveText("250 г");
  expect((await options.first().boundingBox()).height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: testInfo.outputPath("portion-menu-375.png") });
  await options.first().click();
  await expect(page.getByLabel("Количество продукта")).toHaveValue("250");
  await expect(toggle).toBeFocused();
  await toggle.click();
  await expect(options.first()).toHaveAttribute("aria-pressed", "true");
  await toggle.click();

  await page.locator('[data-food-product-action="edit-note"]').click();
  await editor.getByLabel("Название продукта", { exact: true }).fill("Яйцо куриное");
  await page.locator('[data-food-edit-page-action="confirm"]').click();
  await toggle.click();
  await expect(options).toHaveCount(3);
  await expect(options.nth(0)).toHaveText("Мал.≈45 г");
  await expect(options.nth(1)).toHaveText("Сред.≈55 г");
  await expect(options.nth(2)).toHaveText("Бол.≈65 г");
  await page.screenshot({ path: testInfo.outputPath("portion-sizes-375.png") });
  await options.nth(1).click();
  await expect(page.getByLabel("Количество продукта")).toHaveValue("55");
  await expect(page.getByTestId("food-product-macros").locator("strong").first()).toHaveText("52");
  checkErrors();
});

test("compact product editing retains name, icon, macros, units and description", async ({ page }, testInfo) => {
  const checkErrors = failOnRuntimeErrors(page);
  const viewport = { width: 375, height: 667 };
  await page.setViewportSize(viewport);
  await openProduct(page);
  await page.locator('[data-food-product-action="edit-note"]').click();
  await verifyEditor(page, viewport, testInfo.outputPath("edit-375.png"));
  const editor = page.getByTestId("food-edit-page");
  await expect(editor).toHaveAttribute("aria-label", "Редактирование продукта");
  await editor.getByLabel("Название продукта", { exact: true }).fill("Хлеб с отрубями");
  await editor.getByLabel("Иконка", { exact: true }).fill("🍞");
  for (const [label, value] of [["Ккал", "230"], ["Белки", "10"], ["Жиры", "3"], ["Углеводы", "40"]]) {
    await editor.getByLabel(label, { exact: true }).fill(value);
  }
  await editor.getByTestId("food-edit-basic-portion").locator("input").fill("250");
  const unit = editor.getByLabel("Сменить единицу порции");
  await unit.click();
  await expect(unit).toHaveText("мл");
  await unit.click();
  await expect(unit).toHaveText("г");
  await editor.getByLabel("Описание продукта").fill("Состав и данные с этикетки");
  await page.locator('[data-food-edit-page-action="confirm"]').click();
  await expect(editor).toBeHidden();
  await expect(page.getByTestId("food-product-hero")).toContainText("Хлеб с отрубями");
  await expect(page.getByTestId("food-product-note-card")).toContainText("Состав и данные с этикетки");
  checkErrors();
});

for (const type of ["food", "dish"]) {
  test(`compact new ${type} form fits mobile and keeps its workflow`, async ({ page }, testInfo) => {
    const checkErrors = failOnRuntimeErrors(page);
    for (const viewport of [{ width: 375, height: 667 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      await openNew(page, type);
      const editor = page.getByTestId("food-edit-page");
      await expect(editor).toHaveAttribute("aria-label", type === "dish" ? "Новое блюдо" : "Новый продукт");
      expect(await editor.evaluate(node => node.contains(document.activeElement) && document.activeElement.tagName === "INPUT")).toBe(false);
      await verifyEditor(page, viewport, viewport.width === 375 ? testInfo.outputPath(`new-${type}-375.png`) : null);
      const save = page.locator('[data-food-edit-page-action="confirm"]');
      await expect(save).toBeDisabled();
      await editor.getByLabel(type === "dish" ? "Название блюда" : "Название продукта", { exact: true }).fill(type === "dish" ? "Сырники" : "Йогурт");
      await expect(save).toBeEnabled();
      if (type === "dish") {
        await editor.getByTestId("food-edit-basic-portion").locator("input").fill("350");
        await expect(editor.getByTestId("food-edit-basic-portion").locator("input")).toHaveValue("350");
        await editor.locator('[data-dish-ingredients-action="add"]').click();
        await page.locator("[data-dish-ingredient-result]").first().click();
        await page.locator('[data-dish-ingredient-action="add"]').click();
        await expect(editor.locator('[data-dish-ingredients-action="remove"]')).toHaveCount(1);
        await editor.locator('[data-dish-ingredients-action="remove"]').click();
        await expect(editor.getByTestId("dish-edit-ingredients-empty")).toBeVisible();
      }
      await save.click();
      await expect(editor).toBeHidden();
    }
    checkErrors();
  });
}
