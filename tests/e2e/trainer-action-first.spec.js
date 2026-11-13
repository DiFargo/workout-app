import { expect, test } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

test.setTimeout(60_000);
test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.project.name.startsWith("mobile")) await page.setViewportSize({ width: 402, height: 874 });
});

async function navigate(page, section) {
  const mobile = page.getByTestId(`trainer-nav-${section}`);
  const button = await mobile.isVisible()
    ? mobile
    : page.getByTestId(`trainer-desktop-nav-${section}`);
  await button.click();
  await expect(button).toHaveAttribute("aria-current", "page");
}

async function openHarness(page) {
  await page.goto("/?trainerHarness=1&primaryScreensAudit=1");
  await expect(page.getByTestId("trainer-priority-panel")).toBeVisible({ timeout: 40_000 });
}

async function expectContained(page) {
  const metrics = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    main: document.querySelector(".trainerNextMain")?.getBoundingClientRect().toJSON()
  }));
  expect(metrics.document, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.viewport + 1);
  expect(metrics.main?.left).toBeGreaterThanOrEqual(-1);
  expect(metrics.main?.right).toBeLessThanOrEqual(metrics.viewport + 1);
}

async function expectGlassDock(page) {
  const dock = await page.locator(".trainerNextMobileNav").isVisible()
    ? page.locator(".trainerNextMobileNav")
    : page.locator(".trainerNextDesktopDock");
  await expect(dock).toBeVisible();
  const presentation = await dock.evaluate(element => {
    const style = getComputedStyle(element);
    return {
      bounds: element.getBoundingClientRect().toJSON(),
      viewport: { width: innerWidth, height: innerHeight },
      radius: parseFloat(style.borderTopLeftRadius),
      blur: style.backdropFilter || style.webkitBackdropFilter,
      touchTargets: [...element.querySelectorAll(":scope > button")].map(button => button.getBoundingClientRect().toJSON())
    };
  });
  expect(presentation.blur).toContain("blur(");
  expect(presentation.radius).toBeGreaterThanOrEqual(24);
  expect(presentation.bounds.left).toBeGreaterThan(0);
  expect(presentation.bounds.right).toBeLessThan(presentation.viewport.width);
  expect(presentation.bounds.bottom).toBeLessThanOrEqual(presentation.viewport.height);
  expect(presentation.touchTargets).toHaveLength(5);
  for (const target of presentation.touchTargets) {
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(target.height).toBeGreaterThanOrEqual(44);
  }
  // The single highlight must follow the selected destination, not stay behind.
  await expect.poll(() => dock.evaluate(element => {
    const lens = element.querySelector("[data-trainer-nav-lens]")?.getBoundingClientRect();
    const active = element.querySelector("button[aria-current='page']")?.getBoundingClientRect();
    return lens && active ? Math.max(Math.abs(lens.left - active.left), Math.abs(lens.width - active.width)) : Infinity;
  })).toBeLessThanOrEqual(2);
}

async function chooseTheme(page, name, value) {
  await navigate(page, "more");
  await page.getByRole("button", { name: /Оформление/ }).click();
  const dialog = page.getByRole("dialog", { name: "Оформление", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("radio", { name, exact: true }).check();
  await expect(page.locator("html")).toHaveAttribute("data-trainer-appearance", value);
  await dialog.getByRole("button", { name: "Готово", exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function expectReadableDarkCard(locator) {
  await expect(locator).toBeVisible();
  const result = await locator.evaluate(element => {
    const parse = value => {
      const channels = value.match(/[\d.]+/g)?.map(Number) || [];
      return channels.length >= 3 ? channels : [0, 0, 0, 0];
    };
    const luminance = channels => channels.slice(0, 3).map(value => {
      const normalized = value / 255;
      return normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    let background = [0, 0, 0];
    for (let node = element; node; node = node.parentElement) {
      const candidate = parse(getComputedStyle(node).backgroundColor);
      if (candidate.length === 3 || candidate[3] >= .95) { background = candidate; break; }
    }
    const text = element.querySelector("strong, h2, h3") || element;
    const foreground = parse(getComputedStyle(text).color);
    const bg = luminance(background);
    const fg = luminance(foreground);
    return { background, foreground, contrast: (Math.max(bg, fg) + .05) / (Math.min(bg, fg) + .05) };
  });
  expect(Math.max(...result.background.slice(0, 3)), JSON.stringify(result)).toBeLessThan(150);
  expect(result.contrast, JSON.stringify(result)).toBeGreaterThanOrEqual(4.5);
}

test("priority action opens its real client without resolving the task merely by viewing", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  const duplicateKeys = [];
  page.on("console", message => {
    if (message.type() === "error" && /same key|unique.*key/i.test(message.text())) duplicateKeys.push(message.text());
  });
  await openHarness(page);
  const priority = page.getByTestId("trainer-priority-panel");
  await expect(priority).toContainText("Новый клиент");
  await expect(priority).toContainText("Программа, расписание и питание");
  const firstAction = page.getByTestId("trainer-priority-action");
  const actionName = await firstAction.textContent();
  await expect(firstAction).toBeEnabled();
  await firstAction.click();
  await expect(page.locator(".trainerNextClientPage")).toBeVisible();
  await expect(page.locator(".trainerNextClientPage")).toContainText("Новый клиент");
  // Looking at a task must not mark its underlying setup condition as done.
  const closeSetup = page.getByRole("button", { name: "Закрыть настройку", exact: true });
  if (await closeSetup.isVisible()) {
    await closeSetup.click();
    const dismiss = page.getByRole("button", { name: "Закрыть мастер", exact: true });
    if (await dismiss.isVisible()) await dismiss.click();
  }
  await page.getByRole("button", { name: "Назад к списку клиентов", exact: true }).click();
  await expect(page.locator(".trainerNextClientTable > button")).toHaveCount(3);
  await expect(page.locator(".trainerNextClientTable > button").filter({ hasText: "Новый клиент" })).toHaveCount(1);
  await navigate(page, "dashboard");
  await expect(page.getByTestId("trainer-priority-panel")).toContainText("Новый клиент");
  await expect(page.getByTestId("trainer-priority-action")).toHaveText(actionName);
  await expectContained(page);
  expect(duplicateKeys).toEqual([]);
  assertNoRuntimeErrors();
});

test("five trainer destinations keep search, filters and navigation usable", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await openHarness(page);
  const nav = await page.locator(".trainerNextMobileNav").isVisible()
    ? page.locator(".trainerNextMobileNav")
    : page.locator(".trainerNextDesktopDock");
  await expect(nav.locator("button")).toHaveCount(5);
  await expectGlassDock(page);
  await navigate(page, "clients");
  const search = page.getByRole("searchbox", { name: "Поиск клиента", exact: true });
  await search.fill("Александра");
  await expect(page.locator(".trainerNextClientTable > button")).toHaveCount(1);
  await expect(page.locator(".trainerNextClientTable > button")).toContainText("Александра Константинопольская");
  await search.clear();
  await page.getByRole("button", { name: "Внимание", exact: true }).click();
  await expect(page.getByRole("button", { name: "Внимание", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Все", exact: true }).click();
  await expect(page.locator(".trainerNextClientTable > button")).toHaveCount(3);
  await expectContained(page);
  await navigate(page, "workouts");
  await expect(page.getByRole("button", { name: "Создать шаблон", exact: true })).toBeVisible();
  const programSearch = page.getByRole("searchbox", { name: "Найти программу", exact: true });
  await programSearch.fill("tren+");
  await expect(page.getByTestId("trainer-program-overview-grid").locator(":scope > article")).toHaveCount(1);
  await expectContained(page);
  await navigate(page, "library");
  await expect(page.getByRole("searchbox", { name: "Поиск упражнений", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Создать новое упражнение", exact: true })).toBeVisible();
  await expectContained(page);
  await navigate(page, "more");
  await expect(page.getByRole("region", { name: "Кабинет тренера", exact: true })).toBeVisible();
  await expectGlassDock(page);
  await expectContained(page);
  assertNoRuntimeErrors();
});

test("appearance chooser supports radio keys and Escape from its close control", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await openHarness(page);
  await navigate(page, "more");
  await page.getByRole("button", { name: /Оформление/ }).click();
  const dialog = page.getByRole("dialog", { name: "Оформление", exact: true });
  const light = dialog.getByRole("radio", { name: "Светлая", exact: true });
  const dark = dialog.getByRole("radio", { name: "Тёмная", exact: true });
  await light.focus();
  await light.press("ArrowRight");
  await expect(dark).toHaveAttribute("aria-checked", "true");
  await expect(dark).toBeFocused();
  await dark.press("Home");
  await expect(light).toHaveAttribute("aria-checked", "true");
  await expect(light).toBeFocused();
  await light.press("End");
  await expect(dark).toHaveAttribute("aria-checked", "true");
  const close = dialog.getByRole("button", { name: "Закрыть: Оформление", exact: true });
  await close.focus();
  await close.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.locator("html")).toHaveAttribute("data-trainer-appearance", "dark");
  assertNoRuntimeErrors();
});

test("small mobile viewport keeps all five destinations and the dock usable", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile compatibility check");
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await openHarness(page);
  for (const section of ["dashboard", "clients", "workouts", "library", "more"]) {
    await navigate(page, section);
    await expectContained(page);
    await expectGlassDock(page);
  }
  assertNoRuntimeErrors();
});

test("light and dark appearance stays readable across all five main screens and survives reload", async ({ page }) => {
  const assertNoRuntimeErrors = failOnRuntimeErrors(page);
  await openHarness(page);
  await chooseTheme(page, "Тёмная", "dark");
  await expectReadableDarkCard(page.locator(".trainerCabinetHero"));
  await navigate(page, "dashboard");
  await expectReadableDarkCard(page.getByTestId("trainer-priority-panel"));
  await expectContained(page);
  await navigate(page, "clients");
  await expectReadableDarkCard(page.locator(".trainerNextClientTable > button").first());
  await expectContained(page);
  await navigate(page, "workouts");
  await expectReadableDarkCard(page.getByTestId("trainer-program-overview-grid").locator(":scope > article").first());
  await expectContained(page);
  await navigate(page, "library");
  await expectReadableDarkCard(page.locator(".trainerNextLibraryPage article[role='button']").first());
  await expectContained(page);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-trainer-appearance", "dark");
  await expect(page.getByTestId("trainer-priority-panel")).toBeVisible();
  await chooseTheme(page, "Светлая", "light");
  await navigate(page, "dashboard");
  await expectContained(page);
  assertNoRuntimeErrors();
});
