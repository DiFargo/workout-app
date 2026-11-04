import { expect, test } from "./app-test.js";
import { failOnRuntimeErrors } from "./runtime-errors.js";

const fixture = "/tests/e2e/fixtures/trainer-assignment-progress.html";
const cards = page => page.getByTestId("assignment-exercise-card");

test.beforeEach(async ({ page }) => {
  page.setDefaultTimeout(10_000);
  await page.setViewportSize({ width: 402, height: 874 });
  const prohibited = [];
  const verifyRuntime = failOnRuntimeErrors(page);
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
      || url.pathname.startsWith("/api/") || !["GET", "HEAD"].includes(request.method())) {
      prohibited.push(`${request.method()} ${url.origin}${url.pathname}`);
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  page.__assignmentProgressVerify = () => {
    verifyRuntime();
    expect(prohibited, "Fixture must not attempt external/API/mutation requests").toEqual([]);
  };
});

test.afterEach(async ({ page }) => page.__assignmentProgressVerify?.());

async function open(page, scenario) {
  await page.goto(`${fixture}?scenario=${scenario}`);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(cards(page)).toHaveCount(scenario === "search" ? 3 : 1);
}

async function screenshot(page, testInfo, name) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

async function noHorizontalOverflow(page) {
  const geometry = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    dialog: (() => { const r = document.querySelector('[role="dialog"]').getBoundingClientRect(); return { left: r.left, right: r.right }; })()
  }));
  expect(geometry.document).toBeLessThanOrEqual(geometry.viewport + 1);
  expect(geometry.dialog.left).toBeGreaterThanOrEqual(-1);
  expect(geometry.dialog.right).toBeLessThanOrEqual(geometry.viewport + 1);
}

async function assertPointTargets(page, count) {
  const points = page.getByTestId("assignment-history-point");
  await expect(points).toHaveCount(count);
  for (const point of await points.all()) {
    await expect(point).toHaveRole("button");
    await expect(point).toHaveAccessibleName(/\d/);
    const box = await point.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
}

for (const [scenario, count] of [["return", 3], ["trend", 6], ["unknown", 3], ["single", 1], ["bodyweight", 3], ["mixed", 3], ["variableplan", 3], ["empty", 0]]) {
  test(`${scenario}: recorded history, honest plan and adaptive card`, async ({ page }, testInfo) => {
    await open(page, scenario);
    await expect(page.getByTestId("assignment-fixture-state")).toHaveAttribute("data-session-count", String(count));
    await expect(cards(page)).not.toContainText(/Возможный регресс|e1RM/i);
    await expect(page.getByTestId("assignment-progress-chart")).toHaveCount(count >= 4 ? 1 : 0);
    await assertPointTargets(page, count);
    if (scenario === "return") {
      await expect(page.getByTestId("assignment-progress-summary")).toContainText("План выполнен");
      await expect(cards(page)).toContainText("Возврат к плановой нагрузке");
    }
    if (scenario === "variableplan") await expect(cards(page)).not.toContainText("Возврат к плановой нагрузке");
    if (scenario === "unknown") {
      await page.getByTestId("assignment-history-point").last().click();
      const detail = page.getByTestId("assignment-session-detail");
      await expect(detail).toContainText("План этой тренировки не сохранён");
      await expect(detail).not.toContainText("40");
      await expect(cards(page)).not.toContainText("План выполнен");
    }
    if (scenario === "mixed") await expect(page.getByTestId("assignment-progress-summary")).not.toContainText("План выполнен");
    if (scenario === "bodyweight") await expect(cards(page)).toContainText(/без (дополнительного )?веса|собственн/i);
    if (scenario === "trend") await expect(cards(page)).toContainText("Максимальный рабочий вес, кг");
    if (count) {
      const details = page.getByTestId("assignment-progress-details");
      await expect(details).toHaveJSProperty("tagName", "DETAILS");
    }
    await noHorizontalOverflow(page);
    await cards(page).scrollIntoViewIfNeeded();
    await screenshot(page, testInfo, `assignment-${scenario}-402`);
  });
}

for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
  test(`history remains operable at ${viewport.width}×${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await open(page, "trend");
    await assertPointTargets(page, 6);
    await noHorizontalOverflow(page);
    const last = page.getByTestId("assignment-history-point").last();
    await last.click();
    await expect(page.getByTestId("assignment-session-detail")).toBeVisible();
    const save = page.getByRole("button", { name: "Назначить программу", exact: true });
    await expect(save).toBeInViewport();
    await expect(save).toBeEnabled();
    await screenshot(page, testInfo, `assignment-trend-${viewport.width}`);
  });
}

test("all eight sessions expose details through tap and keyboard", async ({ page, hasTouch }) => {
  await open(page, "eight");
  await assertPointTargets(page, 8);
  const points = page.getByTestId("assignment-history-point");
  for (let index = 0; index < 8; index += 1) {
    const point = points.nth(index);
    await point.focus();
    await page.keyboard.press("Enter");
    await expect(point).toHaveAttribute("aria-pressed", "true");
    const detail = page.getByTestId("assignment-session-detail");
    const date = new Date(Date.UTC(2026, 9, 1 + index * 3, 12)).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
    const weight = [25, 27.5, 30, 32.5, 30, 35, 32.5, 35][index].toLocaleString("ru-RU");
    await expect(detail).toBeVisible();
    await expect(detail).toHaveAttribute("aria-label", `Данные тренировки ${date}`);
    await expect(detail.locator("tbody tr")).toHaveCount(3);
    await expect(detail.locator("tbody tr").first().locator("td").first()).toHaveText(weight);
    if (hasTouch) await point.tap();
    else await point.click();
    await expect(point).toHaveAttribute("aria-pressed", "true");
    await expect(detail).toHaveAttribute("aria-label", `Данные тренировки ${date}`);
  }
  await expect(points.first()).toHaveAttribute("aria-pressed", "false");
});

test("chart distinguishes real actual load from historical plan and gaps", async ({ page }) => {
  await open(page, "trend");
  const chart = page.getByTestId("assignment-progress-chart");
  const actual = chart.locator('[data-series="actual"]');
  const planned = chart.locator('[data-series="planned"]');
  await expect(actual).toHaveCount(1);
  expect(await actual.evaluate(element => getComputedStyle(element).strokeDasharray)).toBe("none");
  await expect(planned).toHaveCount(2);
  for (const segment of await planned.all()) {
    expect(await segment.evaluate(element => getComputedStyle(element).strokeDasharray)).not.toBe("none");
  }
  // The missing third snapshot cannot be replaced with the next template's 40 kg.
  await page.getByTestId("assignment-history-point").nth(2).click();
  await expect(page.getByTestId("assignment-session-detail")).toContainText("План этой тренировки не сохранён");
  await expect(page.getByTestId("assignment-session-detail")).not.toContainText("40");
});

test("weight correction and automatically generated program name reach onConfirm once", async ({ page }) => {
  await open(page, "return");
  await expect(page.getByRole("textbox", { name: "Название программы для клиента", exact: true })).toHaveCount(0);
  await page.getByRole("spinbutton", { name: "Поправка веса для упражнения Жим лёжа", exact: true }).fill("2.5");
  await page.getByRole("button", { name: "Назначить с правками (1)", exact: true }).click();
  await expect(page.getByTestId("assignment-fixture-closed")).toBeVisible();
  await expect(page.getByTestId("assignment-fixture-state")).toHaveAttribute("data-confirm-calls", "1");
  const result = JSON.parse(await page.getByTestId("assignment-confirm-result").textContent());
  expect(result).toEqual({ programName: "Программа Следующая программа — Тестовый", loadAdjustments: { "жим лёжа": "2.5" } });
});

test("exercise search normalizes case, ё, compatibility whitespace and AND tokens", async ({ page }) => {
  await open(page, "search");
  const search = page.getByRole("searchbox", { name: "Поиск упражнений", exact: true });
  const count = page.getByTestId("assignment-search-count");
  await expect(search).toBeVisible();
  await expect(count).toHaveText(/3/);
  await expect(page.getByRole("textbox", { name: "Название программы для клиента", exact: true })).toHaveCount(0);
  for (const query of ["ЖИМ", "  жим   ЛЕЖА  ", "жим ле\u0308жа", "\u00a0ЖИМ\u00a0ЛЕЖА\u00a0"]) {
    await search.fill(query);
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page)).toContainText("Жим лёжа");
    await expect(count).toHaveText(/1/);
  }
  await search.fill("БЛОКА тяга");
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page)).toContainText("Тяга верхнего блока");
  await search.fill("  \u00a0  ");
  await expect(cards(page)).toHaveCount(3);
});

test("empty exercise search stays local and offers clear recovery with restored focus", async ({ page }) => {
  await open(page, "search");
  const search = page.getByRole("searchbox", { name: "Поиск упражнений", exact: true });
  const empty = page.getByTestId("assignment-search-empty");
  for (const query of ["жим тяга", "Следующая программа", "Тестовый клиент", "несуществующее упражнение"]) {
    await search.fill(query);
    await expect(cards(page)).toHaveCount(0);
    await expect(page.getByTestId("assignment-search-count")).toHaveText(/0/);
    await expect(empty).toBeVisible();
  }
  await empty.getByRole("button").click();
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();
  await expect(cards(page)).toHaveCount(3);
  await expect(empty).toHaveCount(0);
  await search.fill("ПЛАНКА");
  await expect(cards(page)).toHaveCount(1);
  const clear = page.getByRole("button", { name: "Очистить поиск упражнений", exact: true });
  await expect(clear).toBeVisible();
  await clear.click();
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("");
  await expect(cards(page)).toHaveCount(3);
  await expect(page.getByTestId("assignment-search-count")).toHaveText(/3/);
});

test("filtered-out weight adjustments survive returning and are submitted while hidden", async ({ page }) => {
  await open(page, "search");
  const search = page.getByRole("searchbox", { name: "Поиск упражнений", exact: true });
  const bench = page.getByRole("spinbutton", { name: "Поправка веса для упражнения Жим лёжа", exact: true });
  const pulldown = page.getByRole("spinbutton", { name: "Поправка веса для упражнения Тяга верхнего блока", exact: true });
  await bench.fill("2.5");
  await search.fill("тяга блока");
  await expect(bench).toHaveCount(0);
  await pulldown.fill("5");
  await page.getByRole("button", { name: "Очистить поиск упражнений", exact: true }).click();
  await expect(bench).toHaveValue("2.5");
  await expect(pulldown).toHaveValue("5");
  await search.fill("планка");
  await expect(cards(page)).toHaveCount(1);
  await expect(bench).toHaveCount(0);
  await expect(pulldown).toHaveCount(0);
  await page.getByRole("button", { name: "Назначить с правками (2)", exact: true }).click();
  await expect(page.getByTestId("assignment-fixture-closed")).toBeVisible();
  await expect(page.getByTestId("assignment-fixture-state")).toHaveAttribute("data-confirm-calls", "1");
  const result = JSON.parse(await page.getByTestId("assignment-confirm-result").textContent());
  expect(result).toEqual({
    programName: "Программа Следующая программа — Тестовый",
    loadAdjustments: { "жим лёжа": "2.5", "тяга верхнего блока": "5" }
  });
});

test("Escape clears active exercise search before closing the assignment window", async ({ page }) => {
  await open(page, "search");
  const search = page.getByRole("searchbox", { name: "Поиск упражнений", exact: true });
  await search.fill("верхнего");
  await expect(cards(page)).toHaveCount(1);
  await expect(search).toBeFocused();
  await search.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();
  await expect(cards(page)).toHaveCount(3);
  await expect(page.getByTestId("assignment-fixture-state")).toHaveAttribute("data-confirm-calls", "0");
  await search.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("assignment-fixture-closed")).toBeVisible();
  await expect(page.getByTestId("assignment-fixture-state")).toHaveAttribute("data-confirm-calls", "0");
});

for (const viewport of [{ width: 402, height: 874 }, { width: 320, height: 568 }, { width: 1366, height: 900 }]) {
  test(`exercise search is readable and touch-sized at ${viewport.width}×${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await open(page, "search");
    const search = page.getByRole("searchbox", { name: "Поиск упражнений", exact: true });
    await search.scrollIntoViewIfNeeded();
    const searchBox = await search.boundingBox();
    expect(searchBox?.height).toBeGreaterThanOrEqual(44);
    await noHorizontalOverflow(page);
    await screenshot(page, testInfo, `assignment-search-all-${viewport.width}`);
    await search.fill("верхнего");
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page)).toContainText("Тяга верхнего блока");
    const clear = page.getByRole("button", { name: "Очистить поиск упражнений", exact: true });
    const clearBox = await clear.boundingBox();
    expect(clearBox?.width).toBeGreaterThanOrEqual(44);
    expect(clearBox?.height).toBeGreaterThanOrEqual(44);
    await noHorizontalOverflow(page);
    await screenshot(page, testInfo, `assignment-search-filtered-${viewport.width}`);
  });
}

test("desktop trainer sees readable return and trend cards at 1366×900", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  for (const scenario of ["return", "trend"]) {
    await open(page, scenario);
    await cards(page).scrollIntoViewIfNeeded();
    await expect(page.getByTestId("assignment-progress-summary")).toBeVisible();
    await noHorizontalOverflow(page);
    if (scenario === "return") await expect(cards(page)).toContainText("Возврат к плановой нагрузке");
    else await expect(page.getByTestId("assignment-progress-chart")).toBeVisible();
    await screenshot(page, testInfo, `assignment-${scenario}-1366`);
  }
});
