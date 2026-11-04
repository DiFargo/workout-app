import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { transform } from "lightningcss";
import { chromium, expect } from "@playwright/test";

const sourcePath = (path) => fileURLToPath(new URL(path, import.meta.url)).replaceAll("\\", "/");
const componentPath = sourcePath("../src/components/trainer/TrainerMeasurementsModal.jsx");
const focusHookPath = sourcePath("../src/shared/hooks/useModalFocusTrap.js");
const backHookPath = sourcePath("../src/shared/hooks/useAppBackNavigation.js");
const css = [];
const bundle = await rolldown({ input: "trainer-measurements-scene", platform: "browser", transform: { jsx: { runtime: "automatic" } },
  plugins: [{ name: "trainer-measurements-local-react",
    resolveId(id) { return id === "trainer-measurements-scene" ? id : null; },
    async load(id) {
      if (id.endsWith(".css")) {
        const result = transform({ filename: id, code: await readFile(id), cssModules: true, errorRecovery: false });
        css.push(result.code.toString());
        const names = Object.fromEntries(Object.entries(result.exports).map(([key, value]) => [key, value.name]));
        return { moduleType: "js", code: `export default ${JSON.stringify(names)};` };
      }
      if (id !== "trainer-measurements-scene") return null;
      return { moduleType: "jsx", code: `
        import React,{useState}from'react';import{createRoot}from'react-dom/client';
        import Modal from ${JSON.stringify(componentPath)};
        import{useModalFocusTrap}from ${JSON.stringify(focusHookPath)};
        import{useAppBackNavigation}from ${JSON.stringify(backHookPath)};
        const fields=[['weight','Вес','кг'],['neck','Шея','см'],['shoulders','Плечи','см'],['chest','Грудь','см'],
          ['biceps','Бицепс','см'],['forearm','Предплечье','см'],['wrist','Запястье','см'],['belly','Талия','см'],
          ['pelvis','Таз','см'],['thigh','Бедро','см'],['calf','Икра','см'],['ankle','Лодыжка','см']].map(([id,label,unit])=>({id,label,unit}));
        const make=(day,values={})=>({id:'record-'+day,date:new Date(Date.UTC(2026,0,day,12)),
          weight:80,neck:35,shoulders:110,chest:100,biceps:33,forearm:27,wrist:17,belly:88,pelvis:101,thigh:60,calf:38,ankle:22,...values});
        const standard=[make(31,{wrist:null}),make(2,{weight:82,belly:null}),make(1,{weight:83,belly:90})];
        window.measurementCloseCalls=0;
        function Scene(){const[open,setOpen]=useState(true),[scenario,setScenario]=useState('standard'),[initialView,setInitialView]=useState('fields');
          useModalFocusTrap();useAppBackNavigation({isLoggedIn:true,appLoading:false,page:'trainer',hasTransientScreen:false,
            isPrimaryPage:()=>true,handleTransientBack:()=>false});
          window.measurementScene={show:(name='standard',view='fields')=>{setScenario(name);setInitialView(view);setOpen(true);}};
          const measurements=scenario==='empty'?[]:scenario==='single'?[make(31)]:scenario==='undated'?[make(31,{date:null})]:
            scenario==='many'?Array.from({length:10},(_,index)=>make(31-index,{weight:80+index})):standard;
          return <><button type='button' id='open-measurements' onClick={()=>setOpen(true)}>Открыть замеры</button>
            {open?<Modal key={scenario+initialView} initialView={initialView} measurements={measurements} fields={fields}
              getDate={record=>record?.date??null} getValue={(record,field)=>record?.[field.id]??null}
              insight={{title:'Динамика спокойная',text:'Сопоставляйте замеры с тренировками и питанием.'}}
              onClose={()=>{window.measurementCloseCalls++;setOpen(false);}}/>:null}</>;
        }createRoot(document.getElementById('root')).render(<Scene/>);
      ` };
    }
  }] });
const generated = await bundle.generate({ format: "iife", codeSplitting: false });
await bundle.close();
const code = generated.output.find((item) => item.type === "chunk").code;
const modal = (page) => page.getByTestId("trainer-measurements-modal");
const cards = (page) => page.getByTestId("trainer-measurement-field");
const value = (page) => page.getByTestId("trainer-measurement-trend-value");

async function fixture(run) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
    page.setDefaultTimeout(4000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) => route.abort());
    await page.setContent('<html data-trainer-variant="v2"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="root"></main></body></html>');
    await page.addStyleTag({ content: `body{margin:0;background:#f2f2f7;font-family:Arial,sans-serif}button{font:inherit}${css.join("\n")}` });
    await page.addScriptTag({ content: code });
    await expect(modal(page)).toBeVisible();
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

test("модал замеров: все 12 показателей выбранной даты, честные пропуски и сравнение с предыдущей записью", { timeout: 30000 }, async () => {
  await fixture(async (page) => {
    await expect(page.getByRole("dialog", { name: "Все показатели", exact: true })).toBeVisible();
    await expect(cards(page)).toHaveCount(12);
    await expect(modal(page).getByRole("tabpanel")).toHaveCount(1);
    await expect(modal(page).getByLabel("Дата замера", { exact: true })).toHaveValue("id:record-31:0");
    const weight = cards(page).filter({ has: page.locator("dt", { hasText: /^Вес$/ }) });
    await expect(weight).toContainText("80 кг");
    await expect(weight).toContainText("-2 кг");
    const wrist = cards(page).filter({ has: page.locator("dt", { hasText: "Запястье" }) });
    await expect(wrist).toContainText("Не заполнено");
    await expect(wrist).toContainText("Нет сравнения");
    await expect(wrist).not.toContainText("0 см");
    await modal(page).getByLabel("Дата замера", { exact: true }).selectOption("id:record-2:0");
    await expect(weight).toContainText("82 кг");
    await expect(weight).toContainText("-1 кг");
    await expect(modal(page)).toContainText("Изменения с 1 января 2026 г.");
    await modal(page).getByLabel("Дата замера", { exact: true }).selectOption("id:record-1:0");
    await expect(weight).toContainText("Нет сравнения");
    await expect(modal(page)).toContainText("Дата замера не связана с выбранными фото.");
  });
});

test("модал замеров: история открывает выбранный полный замер в том же окне; вкладки доступны с клавиатуры", { timeout: 30000 }, async () => {
  await fixture(async (page) => {
    await modal(page).getByRole("tab", { name: "История", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "История замеров", exact: true })).toBeVisible();
    await expect(modal(page).getByRole("listitem")).toHaveCount(3);
    await expect(cards(page)).toHaveCount(0);
    const previousRow = modal(page).getByRole("listitem").nth(1);
    await expect(previousRow).toContainText("82 кг");
    await expect(previousRow).toContainText("ТалияНе заполнено");
    await previousRow.getByRole("button", { name: "Показать замер: 2 января 2026 г." }).click();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await expect(cards(page)).toHaveCount(12);
    await expect(modal(page).getByLabel("Дата замера", { exact: true })).toHaveValue("id:record-2:0");
    const fieldsTab = modal(page).getByRole("tab", { name: "Показатели", exact: true });
    await expect(fieldsTab).toBeFocused();
    await page.keyboard.press("End");
    await expect(modal(page).getByRole("tab", { name: "Динамика", exact: true })).toBeFocused();
    await expect(page.getByRole("dialog", { name: "Графики и анализ", exact: true })).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(modal(page).getByRole("tab", { name: "История", exact: true })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Home");
    await expect(fieldsTab).toHaveAttribute("aria-selected", "true");
    assert.equal(await page.evaluate(() => window.measurementCloseCalls), 0);
  });
});

test("модал замеров: график использует реальные интервалы дат, выбор даты/касание/keyboard и не соединяет пропуски", { timeout: 30000 }, async () => {
  await fixture(async (page) => {
    await page.evaluate(() => window.measurementScene.show("standard", "trend"));
    await expect(modal(page).getByLabel("Показатель динамики", { exact: true })).toHaveValue("weight");
    await expect(value(page)).toContainText("80 кг");
    const graph = modal(page).getByRole("slider");
    const positions = await graph.locator("circle").evaluateAll((points) => points.map((point) => Number(point.getAttribute("cx"))));
    assert.equal(positions.length, 3);
    assert.ok(Math.abs((positions[1] - positions[0]) / (positions[2] - positions[0]) - 1 / 30) < 0.000001);
    await graph.focus(); await page.keyboard.press("Home");
    await expect(value(page)).toContainText("83 кг");
    await page.keyboard.press("ArrowRight");
    await expect(value(page)).toContainText("82 кг");
    await modal(page).getByLabel("Дата на графике", { exact: true }).selectOption("id:record-31:0");
    await expect(value(page)).toContainText("80 кг");
    const box = await graph.boundingBox();
    await page.mouse.click(box.x + 45 / 320 * box.width, box.y + 18 / 180 * box.height);
    await expect(value(page)).toContainText("83 кг");
    await modal(page).getByLabel("Показатель динамики", { exact: true }).selectOption("belly");
    await expect(value(page)).toContainText("90 см");
    await expect(modal(page).getByRole("slider").locator("circle")).toHaveCount(2);
    await expect(modal(page).getByTestId("trainer-measurement-trend-segment")).toHaveCount(0);
    await modal(page).getByLabel("Дата на графике", { exact: true }).selectOption("id:record-2:0");
    await expect(value(page)).toContainText("Не заполнено");
    await expect(value(page)).not.toContainText("0 см");
    await expect(modal(page)).toContainText("По последним 3 полным замерам из загруженной истории.");
    await expect(modal(page).getByRole("region", { name: "Анализ замеров" })).toContainText("Сопоставляйте замеры с тренировками и питанием.");
  });
});

test("модал замеров: только последние 8 записей на графике, вся история доступна; единичная/недатированная запись без ложной линии", { timeout: 30000 }, async () => {
  await fixture(async (page) => {
    await page.evaluate(() => window.measurementScene.show("many", "trend"));
    await expect(modal(page).getByLabel("Дата на графике", { exact: true }).locator("option")).toHaveCount(8);
    await expect(modal(page)).toContainText("По последним 8 полным замерам из загруженной истории.");
    await modal(page).getByRole("tab", { name: "История", exact: true }).click();
    await expect(modal(page).getByRole("listitem")).toHaveCount(10);
    await page.evaluate(() => window.measurementScene.show("single", "trend"));
    await expect(modal(page).getByRole("slider").locator("circle")).toHaveCount(1);
    await expect(modal(page).getByTestId("trainer-measurement-trend-segment")).toHaveCount(0);
    await expect(modal(page)).toContainText("Одна точка — без вывода о динамике.");
    await page.evaluate(() => window.measurementScene.show("undated", "trend"));
    await expect(modal(page).getByRole("slider")).toHaveCount(0);
    await expect(modal(page)).toContainText("Нет значений с датой для этого графика.");
    await expect(value(page)).toContainText("Дата не указана");
    await page.evaluate(() => window.measurementScene.show("empty"));
    await expect(modal(page)).toContainText("Полных замеров пока нет.");
    await expect(cards(page)).toHaveCount(0);
  });
});

test("модал замеров: 320/402/1440 без overflow, 44px controls, компактные сетки; Escape/close возвращают фокус без двойного закрытия", { timeout: 30000 }, async () => {
  await fixture(async (page) => {
    await page.getByRole("button", { name: "Закрыть: Все показатели", exact: true }).click();
    await page.locator("#open-measurements").click();
    for (const viewport of [{ width: 320, height: 720 }, { width: 402, height: 874 }, { width: 1440, height: 900 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      await expect(cards(page)).toHaveCount(12);
      const columns = await cards(page).evaluateAll((items) => new Set(items.map((item) => Math.round(item.getBoundingClientRect().x))).size);
      assert.equal(columns, viewport.width >= 844 ? 3 : 2);
      for (const tab of ["Показатели", "История", "Динамика"]) {
        await modal(page).getByRole("tab", { name: tab, exact: true }).click();
        const overflow = await page.getByRole("dialog").evaluate((dialog) => dialog.scrollWidth > dialog.clientWidth || [...dialog.querySelectorAll('[role="tabpanel"]')].some((panel) => panel.scrollWidth > panel.clientWidth));
        assert.equal(overflow, false, `${viewport.width}: ${tab}`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        const undersized = await modal(page).locator('button, select, [role="slider"]').evaluateAll((elements) => elements.map((element) => ({
          name: element.textContent, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height
        })).filter((rect) => rect.width < 43.9 || rect.height < 43.9));
        assert.deepEqual(undersized, []);
        if (viewport.width === 402 || viewport.width === 1440) {
          await mkdir("output/playwright", { recursive: true });
          await page.screenshot({ path: `output/playwright/trainer-measurements-${tab === "Показатели" ? "fields" : tab === "История" ? "history" : "trend"}-${viewport.width}.png` });
        }
      }
      await modal(page).getByRole("tab", { name: "Показатели", exact: true }).click();
    }
    const closeCount = await page.evaluate(() => window.measurementCloseCalls);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("#open-measurements")).toBeFocused();
    assert.equal(await page.evaluate(() => window.measurementCloseCalls), closeCount + 1);
    await page.locator("#open-measurements").click();
    await expect(page.getByRole("button", { name: "Закрыть: Все показатели", exact: true })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("button", { name: "Закрыть", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Закрыть", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("#open-measurements")).toBeFocused();
  });
});
