import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { chromium, expect } from "@playwright/test";

const componentPath = fileURLToPath(new URL("../src/components/trainer/TrainerSummaryStatus.jsx", import.meta.url)).replaceAll("\\", "/");
const bundle = await rolldown({ input: "trainer-summary-status-fixture", platform: "browser",
  transform: { jsx: { runtime: "automatic" } }, plugins: [{ name: "trainer-summary-status-local-react",
    resolveId(id) { return id === "trainer-summary-status-fixture" ? id : null; },
    load(id) {
      if (id.endsWith(".css")) return { code: "export default new Proxy({},{get:(_,key)=>key});", moduleType: "js" };
      if (id !== "trainer-summary-status-fixture") return null;
      return { moduleType: "jsx", code: `
        import React,{useState}from'react';import{createRoot}from'react-dom/client';
        import Status from ${JSON.stringify(componentPath)};
        const initialClients=[{id:'error-id',name:'Анна — ошибка'},{id:'stale-id',name:'Борис — прежние данные'},
          {id:'limited-id',name:'Вера — лимит'},{id:'fresh-id',name:'Глеб — свежие данные'}];
        const initialSummaries={
          'error-id':{trainerSummaryState:'partial',failedSources:['history'],sources:{history:{state:'error',code:'unavailable'}}},
          'stale-id':{trainerSummaryState:'partial',failedSources:['nutrition'],lastUpdatedAt:'2026-10-30T09:00:00Z',
            sources:{nutrition:{state:'stale',updatedAt:'2026-10-30T09:00:00Z'}}},
          'limited-id':{trainerSummaryState:'partial',failedSources:['tasks'],sources:{tasks:{state:'limited'}}},
          'fresh-id':{trainerSummaryState:'fresh',failedSources:[],sources:{history:{state:'fresh'}}}
        };
        window.summaryRetryCalls=[];window.summaryHold=false;window.summaryRelease=null;window.summaryResult=true;window.summaryFailure='';
        function Scene(){const[clients,setClients]=useState(initialClients),[summaries,setSummaries]=useState(initialSummaries),[loading,setLoading]=useState(false);
          window.summaryScene={loading:setLoading,fresh:()=>setSummaries(current=>Object.fromEntries(Object.keys(current).map(id=>[id,
            {trainerSummaryState:'fresh',failedSources:[],sources:{history:{state:'fresh'}}}]))),
            scenario:name=>{
              setLoading(false);
              if(name==='empty'){setClients([]);setSummaries({});return;}
              if(name==='fresh'){setClients(initialClients);setSummaries(Object.fromEntries(initialClients.map(client=>[client.id,{trainerSummaryState:'fresh'}])));return;}
              if(name==='single'){setClients(initialClients.slice(0,1));setSummaries(initialSummaries);return;}
              if(name==='deferred'){
                const next=Array.from({length:25},(_,index)=>({id:'deferred-'+index,name:'Отложенный клиент '+index}));
                setClients(next);setSummaries(Object.fromEntries(next.map(client=>[client.id,{trainerSummaryState:'deferred'}])));return;}
              setClients(initialClients);setSummaries(initialSummaries);
            },hold:()=>window.summaryHold=true,release:()=>{window.summaryHold=false;window.summaryRelease?.();},
            resolveAs:value=>window.summaryResult=value,fail:mode=>window.summaryFailure=mode};
          const retry=async ids=>{window.summaryRetryCalls.push([...ids]);if(window.summaryHold)await new Promise(resolve=>window.summaryRelease=resolve);
            if(window.summaryFailure==='throw')throw new Error('synthetic retry failure');
            if(window.summaryFailure==='false')return false;return window.summaryResult;};
          return <Status clients={clients} summaries={summaries} loading={loading} onRetry={retry}/>;
        }
        createRoot(document.getElementById('root')).render(<Scene/>);
      ` };
    }
  }] });
const generated = await bundle.generate({ format: "iife", codeSplitting: false });
await bundle.close();
const code = generated.output.find(item => item.type === "chunk").code;
const status = page => page.getByTestId("trainer-summary-status");
const details = page => status(page).locator("details");
const summary = page => details(page).locator("summary");
const clientRow = (page, name) => status(page).getByRole("listitem").filter({ hasText: name });
const retryCalls = page => page.evaluate(() => window.summaryRetryCalls);

async function fixture(run) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => route.abort());
    await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><main id="root"></main>');
    await page.addScriptTag({ content: code });
    await expect(status(page)).toBeVisible();
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

test("сводки тренера: пустой список и все fresh скрывают блок, повторное появление partial не нарушает React hooks", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await page.evaluate(() => window.summaryScene.scenario("fresh"));
    await expect(status(page)).toHaveCount(0);
    await page.evaluate(() => window.summaryScene.scenario("empty"));
    await expect(status(page)).toHaveCount(0);
    await page.evaluate(() => window.summaryScene.scenario("partial"));
    await expect(status(page)).toBeVisible();
    assert.deepEqual(await retryCalls(page), []);
  });
});

test("сводки тренера: compact summary раскрывает error/stale/limited по клиентам, limited не считается сетевой ошибкой", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await expect(page.getByRole("complementary", { name: "Состояние данных клиентов" })).toBeVisible();
    await expect(summary(page)).toContainText("Проверить данные · 3");
    await expect(details(page)).not.toHaveAttribute("open", "");
    await expect(clientRow(page, "Анна — ошибка")).toBeHidden();
    await summary(page).click();
    await expect(details(page)).toHaveAttribute("open", "");
    await expect(status(page).getByRole("region", { name: "Подробности загрузки данных" })).toContainText("Данные требуют проверки");
    const failed = clientRow(page, "Анна — ошибка");
    const stale = clientRow(page, "Борис — прежние данные");
    const limited = clientRow(page, "Вера — лимит");
    await expect(failed).toBeVisible();
    await expect(stale).toBeVisible();
    await expect(limited).toBeVisible();
    await expect(failed).toContainText(/Тренировки:.*не удалось обновить/);
    await expect(stale).toContainText(/Питание:/);
    await expect(stale).toContainText("Последняя полная сводка:");
    await expect(limited).toContainText("Задания: выборка ограничена, подробности в карточке клиента");
    assert.equal(/не удалось|ошибка сети|нет соединения|не загрузил/i.test(await limited.textContent()), false);
    await expect(clientRow(page, "Глеб — свежие данные")).toHaveCount(0);
    assert.deepEqual(await retryCalls(page), []);
  });
});

test("сводки тренера: повтор передаёт только client.id, resolve без fresh props не скрывает partial и не показывает успех", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await page.evaluate(() => window.summaryScene.scenario("single"));
    await page.evaluate(() => window.summaryScene.resolveAs(undefined));
    await summary(page).click();
    await clientRow(page, "Анна — ошибка").getByRole("button", { name: "Повторить", exact: true }).click();
    assert.deepEqual(await retryCalls(page), [["error-id"]]);
    await expect(status(page)).toBeVisible();
    await expect(clientRow(page, "Анна — ошибка")).toBeVisible();
    await expect(clientRow(page, "Анна — ошибка")).toContainText("не удалось обновить");
    await page.evaluate(() => window.summaryScene.fresh());
    await expect(status(page)).toHaveCount(0);
  });
});

test("сводки тренера: deferred раскрывает отдельную подгрузку и запрашивает ровно следующие 20 ID", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await page.evaluate(() => window.summaryScene.scenario("deferred"));
    await expect(page.getByRole("complementary", { name: "Подгрузка сводок клиентов" })).toBeVisible();
    await expect(summary(page)).toContainText("Ещё сводки · 25");
    await expect(details(page)).not.toHaveAttribute("open", "");
    await summary(page).click();
    await status(page).getByRole("button", { name: /Загрузить следующие.*сводки/ }).click();
    assert.deepEqual(await retryCalls(page), [Array.from({ length: 20 }, (_, index) => `deferred-${index}`)]);
    await expect(status(page)).toBeVisible();
  });
});

test("сводки тренера: общий loading блокирует retry, но не мешает раскрыть состояние данных", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await page.evaluate(() => window.summaryScene.loading(true));
    await expect(summary(page)).toContainText("Обновляем данные");
    await summary(page).click();
    await expect(details(page)).toHaveAttribute("open", "");
    const buttons = await status(page).getByRole("button", { name: "Повторить", exact: true }).all();
    assert.equal(buttons.length, 3);
    for (const button of buttons) await expect(button).toBeDisabled();
    assert.deepEqual(await retryCalls(page), []);
    await page.evaluate(() => window.summaryScene.scenario("deferred"));
    await page.evaluate(() => window.summaryScene.loading(true));
    if (await details(page).getAttribute("open") === null) await summary(page).click();
    await expect(status(page).getByRole("button", { name: /Загрузить следующие.*сводки/ })).toBeDisabled();
    assert.deepEqual(await retryCalls(page), []);
  });
});

test("сводки тренера: pending не дублирует запрос, Escape закрывает details без изменения исходного состояния", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await page.evaluate(() => window.summaryScene.hold());
    await summary(page).click();
    const retry = clientRow(page, "Анна — ошибка").getByRole("button", { name: "Повторить", exact: true });
    await retry.evaluate(button => { button.click(); button.click(); });
    await expect(retry).toBeDisabled();
    assert.deepEqual(await retryCalls(page), [["error-id"]]);
    await summary(page).focus();
    await page.keyboard.press("Escape");
    await expect(details(page)).not.toHaveAttribute("open", "");
    await expect(summary(page)).toBeFocused();
    await page.evaluate(() => window.summaryScene.release());
    await summary(page).click();
    await expect(clientRow(page, "Анна — ошибка").getByRole("button", { name: "Повторить", exact: true })).toBeEnabled();
    await expect(clientRow(page, "Анна — ошибка")).toContainText("не удалось обновить");
    assert.deepEqual(await retryCalls(page), [["error-id"]]);
  });
});

test("сводки тренера: callback false/throw показывает alert, сохраняет partial и освобождает retry для новой попытки", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await page.evaluate(() => window.summaryScene.scenario("single"));
    await summary(page).click();
    for (const mode of ["false", "throw"]) {
      await page.evaluate(mode => { window.summaryScene.fail(mode); window.summaryScene.hold(); }, mode);
      const retry = clientRow(page, "Анна — ошибка").getByRole("button", { name: "Повторить", exact: true });
      await retry.click();
      await expect(retry).toBeDisabled();
      await expect(status(page).getByRole("alert")).toHaveCount(0);
      await page.evaluate(() => window.summaryScene.release());
      await expect(status(page).getByRole("alert")).toHaveText("Не удалось запустить проверку. Попробуйте ещё раз.");
      await expect(retry).toBeEnabled();
      await expect(clientRow(page, "Анна — ошибка")).toContainText("не удалось обновить");
      await expect(summary(page)).toContainText("Проверить данные · 1");
    }
    assert.deepEqual(await retryCalls(page), [["error-id"], ["error-id"]]);
  });
});
