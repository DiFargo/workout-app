import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { chromium, expect } from "@playwright/test";

const componentPath = JSON.stringify(fileURLToPath(new URL("../src/features/trainer/TrainerProgramOverviewPage.jsx", import.meta.url)).replaceAll("\\", "/"));
const stylesheet = readFileSync(new URL("../src/features/trainer/TrainerProgramOverviewPage.module.css", import.meta.url), "utf8");
const noticeStylesheet = readFileSync(new URL("../src/components/trainer/TrainerLibraryLoadNotice.module.css", import.meta.url), "utf8");
const classNames = Object.fromEntries([...stylesheet.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((match) => [match[1], match[1]]));
const noticeClassNames = Object.fromEntries([...noticeStylesheet.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((match) => [match[1], match[1]]));

// Render the real module styles with identity class names, including nested :has() selectors.
function unwrapGlobals(css) {
  while (css.includes(":global(")) {
    const start = css.indexOf(":global(");
    let end = start + 8;
    let depth = 1;
    for (; end < css.length && depth; end++) {
      if (css[end] === "(") depth++;
      if (css[end] === ")") depth--;
    }
    css = css.slice(0, start) + css.slice(start + 8, end - 1) + css.slice(end);
  }
  return css;
}

const bundle = await rolldown({
  input: "template-purpose-runtime", platform: "browser", transform: { jsx: { runtime: "automatic" } },
  plugins: [{
    name: "template-purpose-fixture",
    resolveId: (id) => id === "template-purpose-runtime" ? id : null,
    load(id) {
      if (id.endsWith(".module.css")) return { code: `export default ${JSON.stringify(id.endsWith("TrainerLibraryLoadNotice.module.css") ? noticeClassNames : classNames)}`, moduleType: "js" };
      if (id !== "template-purpose-runtime") return null;
      return { moduleType: "jsx", code: `
        import React,{useState} from 'react';import{createRoot}from'react-dom/client';
        import Overview from ${componentPath};
        const initialTemplates=[{id:'template-a',name:'Базовая программа',description:'Три тренировки в неделю',createdAt:'2026-10-18'}];
        function Scene(){const[open,setOpen]=useState(false),[selected,setSelected]=useState('');
          const[fixture,setFixture]=useState(()=>window.fixtureInitial||{templates:initialTemplates,loadState:undefined});
          window.fixtureSet=patch=>setFixture(current=>({...current,...patch}));
          const retryLibrary=()=>{window.fixtureRetries=(window.fixtureRetries||0)+1;
            setFixture(current=>({...current,loadState:{...current.loadState,templates:'loading',cards:'loading'}}));};
          return <div className="trainerNextRoot"><Overview clients={[]} adminProgramCreateChoiceOpen={open}
            adminProgramImportInputRef={{current:null}} adminSelectedTemplateId={selected}
            adminTrainingTemplates={fixture.templates} trainerLibraryLoadState={fixture.loadState} onRetryLibrary={retryLibrary}
            canUseAdminFeatures={()=>false} createNewMonthProgramDraft={format=>{window.createdFormat=format}}
            getTemplateStats={()=>({workoutsCount:3,exercisesCount:12})} isTrainerNextWorkspace={()=>true}
            setAdminProgramCreateChoiceOpen={setOpen} setAdminSelectedTemplateId={setSelected}
            openProgramFromLibrary={id=>{window.openedTemplate=id}}
            prepareMonthProgramForAssignment={id=>{window.assignedTemplate=id}}/>
          </div>;
        }createRoot(document.getElementById('root')).render(<Scene/>);` };
    }
  }]
});
const generated = await bundle.generate({ format: "iife" });
await bundle.close();

async function mountOverview(page, initial) {
  await page.setContent('<html data-trainer-variant="v2"><body><div id="root"></div></body></html>');
  if (initial) await page.evaluate(value => { window.fixtureInitial = value; }, initial);
  await page.addStyleTag({ content: `*{box-sizing:border-box}body{margin:0;padding:12px;font-family:Arial,sans-serif} :root{--trainer-text:#1C1C1E;--trainer-muted:#636366;--trainer-accent:#3F73B8} ${unwrapGlobals(stylesheet)} ${unwrapGlobals(noticeStylesheet)}` });
  await page.addScriptTag({ content: generated.output[0].code });
}

for (const width of [320, 402]) {
  test(`actual trainer library explains template and personal copy at ${width}px without changing create flow`, { timeout: 30000 }, async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width, height: 874 } });
      await mountOverview(page);
      const purpose = page.locator(`.${classNames.templatePurpose}`);
      await expect(purpose).toBeVisible();
      await expect(purpose.getByRole("heading", { name: "Шаблон — не план клиента" })).toBeVisible();
      await expect(purpose).toContainText("При назначении клиент получит отдельную копию.");
      await expect(purpose).toContainText("Настройте её персонально в плане клиента.");
      const hierarchy = await purpose.evaluate(element => ({
        textSize: Number.parseFloat(getComputedStyle(element).fontSize),
        titleSize: Number.parseFloat(getComputedStyle(element.querySelector('h2')).fontSize),
        padding: Number.parseFloat(getComputedStyle(element).paddingTop),
        border: Number.parseFloat(getComputedStyle(element).borderTopWidth)
      }));
      assert.ok(hierarchy.textSize >= 16 && hierarchy.titleSize >= 18 && hierarchy.padding >= 16 && hierarchy.border >= 1);
      await expect(page.getByText("Общий шаблон · Три тренировки в неделю", { exact: true })).toBeVisible();
      const cardGeometry = await page.locator(`.${classNames.cardSelect}`).evaluate(card => {
        const description = card.querySelector('p');
        const status = card.querySelector('footer');
        return {
          statusBelowDescription: status.getBoundingClientRect().top >= description.getBoundingClientRect().bottom,
          descriptionFits: description.scrollHeight <= description.clientHeight,
          cardFits: card.scrollWidth <= card.clientWidth
        };
      });
      assert.deepEqual(cardGeometry, { statusBelowDescription: true, descriptionFits: true, cardFits: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await purpose.evaluate(element => element.scrollHeight <= element.clientHeight), true);

      await page.getByRole("button", { name: "Создать шаблон", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Создать общий шаблон", exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("heading", { name: "Создать общий шаблон", exact: true })).toBeVisible();
      await expect(dialog).toContainText("Выберите метку формата для библиотеки.");
      await expect(dialog).toContainText("Любой вариант откроет одинаковый пустой шаблон с одним днём");
      await expect(dialog).toContainText("При назначении клиент получит отдельную копию.");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const firstFormat = dialog.locator("[data-program-format]").first();
      const format = await firstFormat.getAttribute("data-program-format");
      await firstFormat.click();
      await expect(dialog).toHaveCount(0);
      assert.equal(await page.evaluate(() => window.createdFormat), format);
    } finally { await browser.close(); }
  });

  test(`actual template overview distinguishes loading, failure, confirmed empty and cached refresh at ${width}px`, { timeout: 30000 }, async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width, height: 874 } });
      await mountOverview(page, { templates: [], loadState: { templates: "idle", cards: "idle" } });
      const grid = page.getByTestId("trainer-program-overview-grid");
      const createButton = page.getByRole("button", { name: "Создать шаблон", exact: true });
      const assertNotEmpty = async () => {
        await expect(page.getByText("Найдено: 0", { exact: true })).toHaveCount(0);
        await expect(page.getByText("Шаблонов пока нет", { exact: true })).toHaveCount(0);
        await expect(page.getByText("Шаблоны не найдены", { exact: true })).toHaveCount(0);
      };
      const assertFits = async () => {
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        const notice = page.locator(`.${noticeClassNames.notice}`);
        if (await notice.count()) assert.equal(await notice.evaluate(element => element.scrollWidth <= element.clientWidth), true);
      };

      await expect(page.getByRole("status")).toContainText("Загружаем шаблоны…");
      await expect(grid).toHaveAttribute("aria-busy", "true");
      await expect(createButton).toBeDisabled();
      await assertNotEmpty();
      await assertFits();

      await page.evaluate(() => window.fixtureSet({ loadState: { templates: "loading", cards: "loading" } }));
      await expect(page.getByRole("status")).toContainText("Получаем актуальные данные библиотеки.");
      await assertNotEmpty();

      await page.evaluate(() => window.fixtureSet({ loadState: { templates: "error", cards: "ready" } }));
      await expect(page.getByRole("alert")).toContainText("Не удалось загрузить шаблоны");
      await assertNotEmpty();
      const retry = page.getByRole("button", { name: "Повторить загрузку", exact: true });
      await expect(retry).toBeEnabled();
      const retryBounds = await retry.boundingBox();
      assert.ok(retryBounds.width >= 44 && retryBounds.height >= 44);
      await assertFits();
      await retry.click();
      assert.equal(await page.evaluate(() => window.fixtureRetries), 1);
      await expect(page.getByRole("alert")).toHaveCount(0);
      await expect(page.getByRole("status")).toContainText("Загружаем шаблоны…");
      await assertNotEmpty();

      await page.evaluate(() => window.fixtureSet({ loadState: { templates: "ready", cards: "ready" } }));
      await expect(page.getByRole("status")).toHaveCount(0);
      await expect(page.getByText("Шаблонов пока нет", { exact: true })).toBeVisible();
      await expect(page.getByText("Найдено: 0", { exact: true })).toBeVisible();
      await expect(createButton).toBeEnabled();

      await page.evaluate(() => window.fixtureSet({
        templates: [{ id: "saved-template", name: "Сохранённая программа", description: "Три тренировки", createdAt: "2026-10-18" }],
        loadState: { templates: "ready", cards: "ready" }
      }));
      const card = page.getByTestId("trainer-program-overview-card");
      await expect(card).toHaveCount(1);
      await expect(card).toContainText("Сохранённая программа");
      await expect(page.getByText("Найдено: 1", { exact: true })).toBeVisible();
      await page.evaluate(() => { window.retainedTemplateCard = document.querySelector('[data-testid="trainer-program-overview-card"]'); });

      await page.evaluate(() => window.fixtureSet({ loadState: { templates: "loading", cards: "loading" } }));
      await expect(page.getByRole("status")).toContainText("Обновляем шаблоны…");
      await expect(page.getByText("Показано: 1", { exact: true })).toBeVisible();
      await expect(card).toContainText("Сохранённая программа");
      await expect(grid).toHaveAttribute("aria-busy", "true");
      assert.equal(await card.evaluate(element => element === window.retainedTemplateCard), true);
      await assertNotEmpty();
      await assertFits();

      await page.evaluate(() => window.fixtureSet({ loadState: { templates: "error", cards: "ready" } }));
      await expect(page.getByRole("alert")).toContainText("Не удалось полностью загрузить шаблоны");
      await expect(page.getByRole("alert")).toContainText("Показаны доступные данные.");
      await expect(card).toContainText("Сохранённая программа");
      assert.equal(await card.evaluate(element => element === window.retainedTemplateCard), true);
      await assertNotEmpty();
      await assertFits();
      await page.getByRole("button", { name: "Повторить загрузку", exact: true }).click();
      assert.equal(await page.evaluate(() => window.fixtureRetries), 2);
      await expect(page.getByRole("status")).toContainText("Обновляем шаблоны…");
      await expect(card).toBeVisible();

      // Templates do not become an empty/error list just because the separate
      // exercise-card source is still unavailable.
      await page.evaluate(() => window.fixtureSet({ loadState: { templates: "ready", cards: "error" } }));
      await expect(page.getByRole("alert")).toHaveCount(0);
      await expect(page.getByRole("status")).toHaveCount(0);
      await expect(page.getByText("Найдено: 1", { exact: true })).toBeVisible();
      await expect(card).toContainText("Сохранённая программа");
      await assertFits();
    } finally { await browser.close(); }
  });
}
