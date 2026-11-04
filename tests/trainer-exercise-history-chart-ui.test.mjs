import assert from "node:assert/strict";
import test from "node:test";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { transform } from "lightningcss";
import { chromium, expect } from "@playwright/test";

const componentPath = fileURLToPath(new URL("../src/components/trainer/TrainerExerciseHistoryChart.jsx", import.meta.url)).replaceAll("\\", "/");
const cssPath = new URL("../src/components/trainer/TrainerExerciseHistoryChart.module.css", import.meta.url);
const sheet = transform({ filename: "trainer-history-chart.module.css", code: await readFile(cssPath), cssModules: true, errorRecovery: false });
const classNames = Object.fromEntries(Object.entries(sheet.exports).map(([key, value]) => [key, value.name]));
const bundle = await rolldown({ input: "trainer-history-chart-scene", platform: "browser",
  transform: { jsx: { runtime: "automatic" } }, plugins: [{ name: "trainer-history-chart-local-fixture",
    resolveId(id) { return id === "trainer-history-chart-scene" ? id : null; },
    load(id) {
      if (id.endsWith(".css")) return { code: `export default ${JSON.stringify(classNames)};`, moduleType: "js" };
      if (id !== "trainer-history-chart-scene") return null;
      return { moduleType: "jsx", code: `
        import React from'react';import{createRoot}from'react-dom/client';
        import Chart from ${JSON.stringify(componentPath)};
        const base=(day,fields={})=>({date:new Date(Date.UTC(2026,0,day,10)),bestWeight:20,e1rm:26.7,volume:200,totalReps:10,
          bodyweightOnly:false,weightMultiplier:1,weightConvention:'total_external_load',weightConventionLabel:'Вес указан как общий внешний вес',...fields});
        const root=createRoot(document.getElementById('root'));let key=0,currentSessions=[];
        window.chartScene={show:name=>{
          const sessions=name==='empty'?[]:name==='single'?[base(1)]:name==='bodyweight'?[base(1,{bestWeight:0,e1rm:0,volume:0,totalReps:15,bodyweightOnly:true})]:
            name==='many'?Array.from({length:125},(_,i)=>base(125-i,{bestWeight:20+i/10})):
            name==='order'?[base(2,{bestWeight:22.5}),base(31,{bestWeight:30}),base(1),base(2,{bestWeight:24}),base(3,{date:null,bestWeight:99}),base(4,{date:'invalid',bestWeight:98})]:
            name==='gaps'?[base(1),base(2,{bestWeight:0}),base(3,{bestWeight:24}),base(4,{bestWeight:12,weightConvention:'per_hand',weightMultiplier:2}),base(5,{bestWeight:14,weightConvention:'per_hand',weightMultiplier:2})]:
            [base(31,{bestWeight:30,e1rm:40,volume:900,totalReps:30}),base(1),base(2,{bestWeight:22.5,e1rm:30,volume:450,totalReps:20})];
          currentSessions=sessions;root.render(<Chart key={++key} sessions={sessions}/>);
        },appendEarlier:()=>{currentSessions=[base(-5,{bestWeight:18}),...currentSessions];root.render(<Chart key={key} sessions={currentSessions}/>);}};window.chartScene.show('weighted');
      ` };
    }
  }] });
const generated = await bundle.generate({ format: "iife", codeSplitting: false });
await bundle.close();
const code = generated.output.find(item => item.type === "chunk").code;
const chart = page => page.getByTestId("trainer-exercise-history-chart");
const readout = page => page.getByTestId("trainer-history-chart-value");
const sessionKey = (day, occurrence = 0) => `${Date.UTC(2026, 0, day, 10)}:${occurrence}`;

async function fixture(run) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
    page.setDefaultTimeout(4000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => route.abort());
    await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><main id="root"></main>');
    await page.addStyleTag({ content: `body{margin:0;padding:12px;background:#f2f2f7;font-family:Arial,sans-serif}${sheet.code.toString()}` });
    await page.addScriptTag({ content: code });
    await expect(chart(page)).toBeVisible();
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

test("график тренера: реальный X отражает интервалы дат, точные значения доступны keyboard/select/касанием", { timeout: 30000 }, async () => {
  await fixture(async page => {
    const slider = chart(page).getByRole("slider");
    await expect(chart(page).getByRole("button", { name: "Рабочий вес", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(readout(page)).toContainText("30 кг");
    const positions = await slider.locator("circle").evaluateAll(points => points.map(point => Number(point.getAttribute("cx"))));
    assert.equal(positions.length, 3);
    assert.ok(Math.abs((positions[1] - positions[0]) / (positions[2] - positions[0]) - 1 / 30) < 0.000001);
    await slider.focus(); await page.keyboard.press("Home");
    await expect(readout(page)).toContainText("20 кг");
    await page.keyboard.press("ArrowRight");
    await expect(readout(page)).toContainText("22,5 кг");
    await expect(slider).toHaveAttribute("aria-valuenow", "2");
    await chart(page).getByLabel("Запись", { exact: true }).selectOption(sessionKey(31));
    await expect(readout(page)).toContainText("30 кг");
    const firstPoint = await slider.locator("circle").first().evaluate(point => ({ x: Number(point.getAttribute("cx")), y: Number(point.getAttribute("cy")) }));
    const box = await slider.boundingBox();
    await page.mouse.click(box.x + firstPoint.x / 320 * box.width, box.y + firstPoint.y / 184 * box.height);
    await expect(readout(page)).toContainText("20 кг");
    await expect(chart(page).getByRole("button", { name: "Предыдущая запись", exact: true })).toBeDisabled();
    await chart(page).getByRole("button", { name: "Следующая запись", exact: true }).click();
    await expect(readout(page)).toContainText("22,5 кг");
    await mkdir("output/playwright", { recursive: true });
    await page.screenshot({ path: "output/playwright/trainer-exercise-history-chart-402.png" });
    await page.evaluate(() => window.chartScene.appendEarlier());
    await expect(chart(page).getByLabel("Запись", { exact: true }).locator("option")).toHaveCount(4);
    await expect(readout(page)).toContainText("22,5 кг");
  });
});

test("график тренера: показатели сохраняют выбранную дату, отображают реальные единицы и не называют 1ПМ измеренным", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await chart(page).getByLabel("Запись", { exact: true }).selectOption(sessionKey(1));
    for (const [label, expected] of [["Оценочный 1ПМ", "26,7 кг"], ["Объём", "200 кг·повт."], ["Повторы", "10 повт."]]) {
      await chart(page).getByRole("button", { name: label, exact: true }).click();
      await expect(readout(page)).toContainText(expected);
    }
    await chart(page).getByRole("button", { name: "Оценочный 1ПМ", exact: true }).click();
    await expect(chart(page)).toContainText("Оценка по формуле Эпли, а не измеренный максимум.");
    assert.match(await chart(page).getByRole("button", { name: "Оценочный 1ПМ", exact: true }).evaluate(button => getComputedStyle(button).backgroundImage), /linear-gradient/);
    assert.equal(await chart(page).locator("linearGradient").count(), 0, "график остаётся одноцветным");
  });
});

test("график тренера: один замер — точка без линии; bodyweight default — повторы; unknown вес не становится нулём", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await page.evaluate(() => window.chartScene.show("single"));
    await expect(chart(page).getByRole("slider").locator("circle")).toHaveCount(1);
    await expect(chart(page).getByTestId("trainer-history-chart-segment")).toHaveCount(0);
    await expect(chart(page)).toContainText("Одна точка — без вывода о динамике.");
    await page.evaluate(() => window.chartScene.show("bodyweight"));
    await expect(chart(page).getByRole("button", { name: "Повторы", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(readout(page)).toContainText("15 повт.");
    await chart(page).getByRole("button", { name: "Рабочий вес", exact: true }).click();
    await expect(chart(page).getByRole("slider")).toHaveCount(0);
    await expect(readout(page)).toContainText("Нет данных");
    await expect(readout(page)).not.toContainText("0 кг");
  });
});

test("график тренера: SVG не соединяет пропуск и разные способы учёта веса", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await page.evaluate(() => window.chartScene.show("gaps"));
    await expect(chart(page).getByRole("slider").locator("circle")).toHaveCount(4);
    await expect(chart(page).getByTestId("trainer-history-chart-segment")).toHaveCount(1);
    await chart(page).getByLabel("Запись", { exact: true }).selectOption(sessionKey(2));
    await expect(readout(page)).toContainText("Нет данных");
  });
});

test("график тренера: новые записи первыми в селекторе и таблице, график хронологический и выбор переживает догрузку", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await page.evaluate(() => window.chartScene.show("order"));
    const picker = chart(page).getByLabel("Запись", { exact: true });
    const expectedKeys = [sessionKey(31), sessionKey(2), sessionKey(2, 1), sessionKey(1), "undated:0", "undated:1"];
    assert.deepEqual(await picker.locator("option").evaluateAll(options => options.map(option => option.value)), expectedKeys);
    assert.deepEqual((await picker.locator("option").allTextContents()).slice(-2), ["Без даты", "Без даты"]);
    await expect(readout(page)).toContainText("30 кг");
    await chart(page).locator("summary").click();
    const rows = chart(page).locator("tbody tr");
    assert.deepEqual(await rows.locator("td:first-of-type").allTextContents(), ["30 кг", "22,5 кг", "24 кг", "20 кг", "99 кг", "98 кг"]);
    assert.deepEqual(await rows.locator("th").allTextContents(), await picker.locator("option").allTextContents());

    const slider = chart(page).getByRole("slider");
    const positions = await slider.locator("circle").evaluateAll(points => points.map(point => Number(point.getAttribute("cx"))));
    assert.equal(positions.length, 4);
    assert.ok(positions.every((position, index) => !index || position >= positions[index - 1]), "старые точки остаются слева от новых");
    await slider.focus(); await page.keyboard.press("Home");
    await expect(readout(page)).toContainText("20 кг");
    await page.keyboard.press("ArrowRight");
    await expect(readout(page)).toContainText("22,5 кг");
    await page.keyboard.press("ArrowRight");
    await expect(readout(page)).toContainText("24 кг");

    await picker.selectOption(sessionKey(2, 1));
    await expect(picker).toHaveValue(sessionKey(2, 1));
    await page.evaluate(() => window.chartScene.appendEarlier());
    await expect(picker.locator("option")).toHaveCount(7);
    await expect(picker).toHaveValue(sessionKey(2, 1));
    await expect(readout(page)).toContainText("24 кг");
    await expect(chart(page).locator("tbody tr[aria-selected='true'] td:first-of-type")).toHaveText("24 кг");
    assert.deepEqual(await picker.locator("option").evaluateAll(options => options.map(option => option.value)), [...expectedKeys.slice(0, 4), sessionKey(-5), ...expectedKeys.slice(4)]);
  });
});

test("график тренера: все 125 записей доступны в селекторе/таблице, controls ≥44px и нет overflow на 320px", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await page.evaluate(() => window.chartScene.show("many"));
    await expect(chart(page).getByLabel("Запись", { exact: true }).locator("option")).toHaveCount(125);
    await expect(chart(page)).toContainText("По загруженной истории · 125 записей");
    await chart(page).locator("summary").click();
    await expect(chart(page).getByRole("row")).toHaveCount(126);
    for (const viewport of [{ width: 402, height: 874 }, { width: 320, height: 720 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const undersized = await chart(page).locator('button,select,summary,[role="slider"]').evaluateAll(elements => elements
        .map(element => ({ name: element.textContent, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }))
        .filter(rect => rect.width < 43.9 || rect.height < 43.9));
      assert.deepEqual(undersized, []);
      const graphSize = await chart(page).getByRole("slider").boundingBox();
      assert.ok(graphSize.height <= 260.1);
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => window.chartScene.show("empty"));
    await expect(chart(page)).toContainText("В загруженной истории нет записей для графика.");
  });
});
