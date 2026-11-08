import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { rolldown } from "rolldown";
import { chromium, expect } from "@playwright/test";

const source = name => JSON.stringify(resolve(`src/${name}`).replaceAll("\\", "/"));
const styles = readFileSync("src/features/client/nutrition/NutritionSyncRecovery.module.css", "utf8");
const bundle = await rolldown({ input: "nutrition-save-feedback-scene", platform: "browser",
  transform: { jsx: { runtime: "automatic" } }, plugins: [{ name: "nutrition-save-io-only",
    resolveId(id) {
      if (["nutrition-save-feedback-scene", "fixture-auth", "fixture-firestore", "fixture-feedback", "fixture-api"].includes(id)) return id;
      if (id === "firebase/firestore") return "fixture-firestore";
      if (/\/firebase(?:\.js)?$/.test(id)) return "fixture-auth";
      if (/\/appFeedback\.js$/.test(id)) return "fixture-feedback";
      if (/\/apiClient\.js$/.test(id)) return "fixture-api";
      return null;
    },
    load(id) {
      if (id.endsWith(".css")) return { code: 'export default {notice:"notice",compact:"compact",title:"title",description:"description"};', moduleType: "js" };
      if (id === "fixture-auth") return "export const auth={currentUser:{uid:'client'}};export const db={};";
      if (id === "fixture-feedback") return "export const showAppError=()=>{};export const showAppConfirm=async()=>true;";
      if (id === "fixture-api") return "export const fetchAuthorizedWithTimeout=async()=>{throw new Error('network disabled in synthetic UI test')};";
      if (id === "fixture-firestore") return `
        export const io=window.io={docs:{},fail:false,readFail:false,hold:false,releases:[],sets:0,transactions:0};
        export const doc=(_, ...path)=>path.join('/');
        export const getDoc=async path=>{if(io.readFail)throw new Error('synthetic initial load failure');
          return{exists:()=>Object.hasOwn(io.docs,path),data:()=>structuredClone(io.docs[path])}};
        export const runTransaction=async(_,callback)=>{
          io.transactions++;
          if(io.fail)throw new Error('synthetic network failure');
          const hold=io.hold;io.hold=false;
          const result=await callback({get:async path=>({exists:()=>Object.hasOwn(io.docs,path),data:()=>structuredClone(io.docs[path])}),
            set:(path,value)=>{io.docs[path]=structuredClone(value);io.sets++;}});
          if(hold)await new Promise(resolve=>io.releases.push(resolve));return result;
        };
      `;
      if (id !== "nutrition-save-feedback-scene") return null;
      return { moduleType: "jsx", code: `
        import React,{useRef,useState}from'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';
        import{auth}from'fixture-auth';import{io}from'fixture-firestore';
        import Recovery from ${source("features/client/nutrition/NutritionSyncRecovery.jsx")};
        import{useNutritionRuntimeEffects}from ${source("features/client/nutrition/useNutritionRuntimeEffects.js")};
        import{createNutritionCloudLoader}from ${source("features/client/nutrition/nutritionCloudLoader.js")};
        import{rememberNutritionCloudState,beginNutritionSave,acknowledgeNutritionCloudState}from ${source("utils/nutritionSyncRevision.js")};
        import{getFailedNutritionSync,acknowledgeNutritionSync}from ${source("utils/offlineSyncStorage.js")};
        import{saveNutritionStateWithMerge}from ${source("utils/nutritionStateStorage.js")};
        import{stampNutritionDayChange}from ${source("utils/nutritionSyncModel.js")};
        import{mergeNutritionStates}from ${source("utils/nutritionStateMerge.js")};
        import{advanceAuthSession}from ${source("utils/authSession.js")};
        const at='2026-10-30T09:00:00Z',noop=()=>{};
        const withoutBaseline=new URLSearchParams(location.search).get('without-baseline')==='1';
        const initial=withoutBaseline?{__uid:'client',days:{}}:
          mergeNutritionStates({}, {__uid:'client',updatedAt:at,days:{today:{water:100,updatedAt:at,foods:[],fieldUpdatedAt:{water:at}}}});
        io.docs['users/client/nutrition/state']=initial;if(!withoutBaseline)rememberNutritionCloudState(auth,initial);
        let latest,setCurrent,changeUser,cloudLoader;
        const originalWrite=Storage.prototype.setItem;
        Storage.prototype.setItem=function(...args){if(window.storageFull)throw new Error('synthetic quota');return originalWrite.apply(this,args)};
        function App(){const[user,setUser]=useState(auth.currentUser),[nutrition,setNutrition]=useState(initial),[ready,setReady]=useState(!withoutBaseline);
          const undo=useRef(null),video=useRef(null);latest=nutrition;setCurrent=setNutrition;changeUser=setUser;
          cloudLoader=createNutritionCloudLoader({auth,db:{},NUTRITION_STORAGE_KEY:'nutrition',startPerformanceCheck:noop,
            endPerformanceCheck:noop,showAppError:noop,setNutrition,setNutritionCloudReady:setReady});
          useNutritionRuntimeEffects({auth,user,nutrition,nutritionCloudReady:ready,nutritionStorageKey:'nutrition',nutritionBackupStorageKey:'backup',
            nutritionUndoTimerRef:undo,barcodeVideoRef:video,barcodeScannerOpen:false,barcodeSearchEnabled:false,
            setNutrition,showAppError:noop,loadNutritionFromFirebase:noop,setBarcodeScannerError:noop,setBarcodeScannerOpen:noop,setNutritionBarcode:noop});
          const replay=async()=>{const queued=getFailedNutritionSync(auth.currentUser.uid);if(!queued)return;
            const ticket=beginNutritionSave(auth),saved=await saveNutritionStateWithMerge(auth.currentUser.uid,queued.nutrition);
            acknowledgeNutritionCloudState(auth,ticket,saved);acknowledgeNutritionSync(auth.currentUser.uid,queued);
            setNutrition(current=>({...mergeNutritionStates(current,saved),__uid:auth.currentUser.uid}));};
          return <><Recovery onReplay={replay} onRefresh={noop}/><output data-testid='water'>{nutrition.days.today?.water}</output></>;}
        const root=createRoot(document.getElementById('root'));flushSync(()=>root.render(<App/>));
        window.scene={edit:water=>flushSync(()=>setCurrent(current=>{const now=new Date(Date.now()+water).toISOString();return{...current,updatedAt:now,
          days:{...current.days,today:stampNutritionDayChange(current.days.today,{...current.days.today,water},now)}}})),
          current:()=>latest,queue:()=>getFailedNutritionSync(auth.currentUser.uid),release:()=>io.releases.splice(0).forEach(fn=>fn()),
          failInitialLoad:()=>{io.readFail=true;return cloudLoader.loadNutritionFromFirebase(auth.currentUser.uid)},
          changeAuth:uid=>{auth.currentUser={uid};advanceAuthSession(auth);flushSync(()=>{changeUser(auth.currentUser);
            setCurrent({...initial,__uid:uid});});},unmount:()=>root.unmount()};
      ` };
    }
  }] });
const generated = await bundle.generate({ format: "iife", codeSplitting: false });
await bundle.close();
const code = generated.output.find(item => item.type === "chunk").code;

async function fixture(run, { withoutBaseline = false } = {}) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const url = `https://nutrition-feedback.test/${withoutBaseline ? "?without-baseline=1" : ""}`;
    await page.route("**/*", route => route.request().url() === url
      ? route.fulfill({ contentType: "text/html", body: '<meta name="viewport" content="width=device-width,initial-scale=1"><main id="root"></main>' })
      : route.abort());
    await page.goto(url);
    await page.clock.install({ time: new Date("2026-10-30T10:00:00Z") });
    await page.addStyleTag({ content: `body{margin:0;background:#f2f2f7;font-family:Arial,sans-serif}${styles}` });
    await page.addScriptTag({ content: code });
    await expect(withoutBaseline ? page.getByText("Сохранено только на устройстве", { exact: true }) : page.getByTestId("nutrition-save-status")).toBeVisible();
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

test("реальный UI питания: local → отправка → cloud только после ack, новый ввод переживает старый ack", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await page.evaluate(() => { window.io.hold = true; window.scene.edit(200); });
    await expect(page.getByText("Сохранено только на устройстве", { exact: true })).toBeVisible();
    await page.clock.runFor(700);
    await expect(page.getByText("Сохраняем в облако…", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Синхронизируем…" })).toBeDisabled();
    await page.evaluate(() => window.scene.edit(300));
    await page.evaluate(() => window.scene.release());
    await expect(page.getByText("Сохранено только на устройстве", { exact: true })).toBeVisible();
    assert.equal(await page.getByTestId("water").textContent(), "300");
    await expect(page.getByText("Сохранено в облаке", { exact: true })).toHaveCount(0);
    await page.clock.runFor(700);
    await expect(page.getByTestId("nutrition-save-status")).toBeVisible();
    await expect(page.getByTestId("nutrition-save-status")).toHaveAttribute("title", "Сохранено в облаке");
    assert.equal(await page.evaluate(() => window.scene.queue()), null);
  });
});

test("реальный UI питания: отказ облака даёт постоянный повтор и не стирает введённое", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await page.evaluate(() => { window.io.fail = true; window.scene.edit(400); });
    await page.clock.runFor(700);
    await expect(page.getByText("Не удалось сохранить в облаке", { exact: true })).toBeVisible();
    await expect(page.getByText("Локальная копия сохранена. Проверьте интернет и повторите отправку.")).toBeVisible();
    const retry = page.getByRole("button", { name: "Повторить сохранение" });
    const bounds = await retry.boundingBox();
    assert.ok(bounds.height >= 44);
    const actionBackground = await retry.evaluate(element => getComputedStyle(element).backgroundImage);
    assert.match(actionBackground, /linear-gradient/);
    for (const viewport of [{ width: 320, height: 720 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.ok((await retry.boundingBox()).height >= 44);
    }
    await page.evaluate(() => { window.io.fail = false; });
    await retry.click();
    await expect(page.getByTestId("nutrition-save-status")).toBeVisible();
    assert.equal(await page.getByTestId("water").textContent(), "400");
    assert.equal(await page.evaluate(() => window.scene.queue()), null);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  });
});

test("реальный UI питания: смена auth-сессии скрывает старую отправку и отвергает поздний ack", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await page.evaluate(() => { window.io.hold = true; window.scene.edit(600); });
    await page.clock.runFor(700);
    await expect(page.getByText("Сохраняем в облако…", { exact: true })).toBeVisible();
    await page.evaluate(() => window.scene.changeAuth("other"));
    await expect(page.getByText("Сохранено только на устройстве", { exact: true })).toBeVisible();
    await page.evaluate(() => window.scene.release());
    await expect(page.getByText("Сохранено в облаке", { exact: true })).toHaveCount(0);
    assert.equal(await page.getByTestId("water").textContent(), "100");
    assert.equal(await page.evaluate(() => window.scene.queue().nutrition.__uid), "other");
  });
});

test("реальный UI питания: quota не обещает локальную копию, повтор сначала восстанавливает её", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await page.evaluate(() => { window.storageFull = true; window.scene.edit(500); });
    await expect(page.getByText("Не удалось сохранить на устройстве", { exact: true })).toBeVisible();
    await expect(page.getByText(/Не закрывайте приложение\. Освободите место/)).toBeVisible();
    assert.equal(await page.getByTestId("water").textContent(), "500");
    await page.evaluate(() => { window.storageFull = false; });
    await page.getByRole("button", { name: "Повторить сохранение" }).click();
    await expect(page.getByTestId("nutrition-save-status")).toBeVisible();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("nutrition:client")).days.today.water), 500);
    assert.equal(await page.getByTestId("water").textContent(), "500");
  });
});

test("реальный UI питания: отказ первичной загрузки пустого legacy snapshot не подтверждает облако и не запускает пустой autosave", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await page.evaluate(() => window.scene.failInitialLoad());
    await page.clock.runFor(2700);
    await expect(page.getByText("Сохранено в облаке", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Сохранено только на устройстве", { exact: true })).toBeVisible();
    assert.equal(await page.evaluate(() => window.io.transactions), 0);
    assert.equal(await page.evaluate(() => window.io.sets), 0);
    assert.equal(await page.evaluate(() => window.scene.queue()), null);
  }, { withoutBaseline: true });
});
