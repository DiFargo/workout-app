import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { chromium, expect } from "@playwright/test";

const source = name => JSON.stringify(fileURLToPath(new URL(`../src/${name}`, import.meta.url)).replaceAll("\\", "/"));
const bundle = await rolldown({ input: "nutrition-loading-recovery-fixture", platform: "browser",
  transform: { jsx: { runtime: "automatic" } }, plugins: [{ name: "recovery-io-fixture",
    resolveId(id) {
      if (["nutrition-loading-recovery-fixture", "fixture-auth", "fixture-feedback", "fixture-day-client"].includes(id)) return id;
      if (/\/firebase(?:\.js)?$/.test(id)) return "fixture-auth";
      if (/\/appFeedback\.js$/.test(id)) return "fixture-feedback";
      if (/\/nutritionDayClient\.js$/.test(id)) return "fixture-day-client";
      return null;
    },
    load(id) {
      if (id.endsWith(".css")) return { code: "export default {};", moduleType: "js" };
      if (id === "fixture-auth") return "export const auth={currentUser:{uid:'client'}};window.fixtureAuth=auth;";
      if (id === "fixture-feedback") return `export const showAppConfirm=async options=>{window.calls.push('confirm');window.confirmOptions=options;
        return window.holdConfirm?new Promise(resolve=>window.finishConfirm=resolve):window.confirmResult};
        export const showAppError=(...args)=>window.calls.push(['error',...args]);`;
      if (id === "fixture-day-client") return `export const listPendingNutritionDayMutations=()=>window.pendingRows;
        export const rebasePendingNutritionDayMutations=async(uid,options)=>{window.calls.push(['rebase',uid,options]);
          if(window.holdRebase)await new Promise(resolve=>window.finishRebase=resolve);
          window.pendingRows=window.pendingRows.map(row=>({...row,status:'pending'}));};`;
      if (id !== "nutrition-loading-recovery-fixture") return null;
      return { moduleType: "jsx", code: `
        import React,{useState}from'react';import{createRoot}from'react-dom/client';
        import Recovery from ${source("features/client/nutrition/NutritionSyncRecovery.jsx")};
        import{useNutritionLoadingState,mergeNutritionCoverage}from ${source("features/client/nutrition/useNutritionLoadingState.js")};
        import{configureNutritionDayStorage}from ${source("utils/nutritionDayStorageConfig.js")};
        import{advanceAuthSession}from ${source("utils/authSession.js")};
        import{auth}from'fixture-auth';
        configureNutritionDayStorage({enabled:true});advanceAuthSession(auth);
        window.calls=[];window.pendingRows=[{id:'local',status:'rebase-required'}];window.confirmResult=false;
        window.mergeCoverage=mergeNutritionCoverage;
        function Scene(){const[user,setUser]=useState(auth.currentUser),[mounted,setMounted]=useState(true);
          const[nutrition,setNutrition]=useState({__uid:user.uid,__nutritionStorage:{generation:'g',writerEpoch:1},days:{}});
          const state=useNutritionLoadingState({user,nutrition,cloudReady:true});
          window.coverageUpdate=state.onCoverageChange;window.setFixtureNutrition=setNutrition;
          window.changeAuth=uid=>{auth.currentUser=uid?{uid}:null;advanceAuthSession(auth);setUser(auth.currentUser)};
          window.advanceSameAuth=()=>{advanceAuthSession(auth);setUser({...auth.currentUser})};window.unmountRecovery=()=>setMounted(false);
          return <><output data-testid='coverage'>{JSON.stringify({coverage:state.coverage,full:state.historyReady,A:state.isDayReady('A'),B:state.isDayReady('B')})}</output>
            {mounted&&<Recovery key={user?.uid||'none'} onReplay={async()=>{window.calls.push('replay');window.pendingRows=[]}}
              onRefresh={async()=>window.calls.push('refresh')}/>}</>}
        createRoot(document.getElementById('root')).render(<Scene/>);` };
    }
  }] });
const generated = await bundle.generate({ format: "iife", codeSplitting: false }); await bundle.close();

async function fixture(run) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } }); const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setContent('<main id="root"></main>'); await page.addScriptTag({ content: generated.output[0].code });
    await expect(page.getByTestId("nutrition-sync-recovery")).toBeVisible();
    await run(page); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
const coverage = (revision, fields = {}) => ({ uid: "client", generation: "g", writerEpoch: 1, revision,
  complete: false, loadedDayKeys: [], missingDayKeys: [], loading: false, ...fields });
const update = (page, value) => page.evaluate(value => window.coverageUpdate(value), value);
const readState = page => page.getByTestId("coverage").evaluate(element => JSON.parse(element.textContent));

test("actual coverage hook keeps A ready across A → B → cached A and treats known missing days as loaded coverage", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await update(page, coverage(10, { loadedDayKeys: ["A"] }));
    await expect.poll(async () => (await readState(page)).A).toBe(true);
    await update(page, coverage(10, { loadedDayKeys: ["B"], missingDayKeys: ["empty"] }));
    await expect.poll(async () => (await readState(page)).B).toBe(true);
    const state = await readState(page); assert.equal(state.A, true); assert.equal(state.full, false);
    assert.deepEqual(state.coverage.loadedDayKeys, ["A", "B"]); assert.deepEqual(state.coverage.missingDayKeys, ["empty"]);
    // A cache hit performs no new update, so the union must remain usable.
    assert.equal((await readState(page)).A, true);
  });
});

test("actual coverage hook revokes full authority on a new partial revision or generation", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await update(page, coverage(10, { complete: true, loadedDayKeys: ["A", "B"] }));
    await expect.poll(async () => (await readState(page)).full).toBe(true);
    await update(page, coverage(11, { loadedDayKeys: ["B"] }));
    await expect.poll(async () => (await readState(page)).full).toBe(false);
    assert.equal((await readState(page)).A, false); assert.equal((await readState(page)).B, true);
    await update(page, coverage(11, { complete: true, loadedDayKeys: ["A", "B"] }));
    await expect.poll(async () => (await readState(page)).full).toBe(true);
    await update(page, { ...coverage(1, { loadedDayKeys: ["B"] }), generation: "new", writerEpoch: 2 });
    await expect.poll(async () => (await readState(page)).full).toBe(false);
  });
});

test("recovery cancel performs no rebase, replay or refresh and discloses possible deleted-record restoration", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await page.getByRole("button", { name: "Проверить и перенести" }).click();
    await expect(page.getByRole("button", { name: "Проверить и перенести" })).toBeEnabled();
    assert.deepEqual(await page.evaluate(() => window.calls), ["confirm"]);
    const options = await page.evaluate(() => window.confirmOptions);
    assert.match(options.text, /ранее удалённые записи/); assert.match(options.text, /Исходная локальная копия сохранится/);
  });
});

test("confirmed recovery waits for rebase before replay and refresh, then removes the pending notice", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await page.evaluate(() => { window.confirmResult = true; window.holdRebase = true; });
    await page.getByRole("button", { name: "Проверить и перенести" }).click();
    await expect.poll(() => page.evaluate(() => window.calls.length)).toBe(2);
    assert.deepEqual(await page.evaluate(() => window.calls), ["confirm", ["rebase", "client", { confirmed: true }]]);
    await expect(page.getByRole("button", { name: "Синхронизируем…" })).toBeDisabled();
    await page.evaluate(() => window.finishRebase());
    await expect(page.getByTestId("nutrition-sync-recovery")).toHaveCount(0);
    assert.deepEqual(await page.evaluate(() => window.calls), ["confirm", ["rebase", "client", { confirmed: true }], "replay", "refresh"]);
  });
});

test("auth changes during confirmation or rebase discard late recovery continuations", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await page.evaluate(() => { window.holdConfirm = true; });
    await page.getByRole("button", { name: "Проверить и перенести" }).click();
    await expect.poll(() => page.evaluate(() => typeof window.finishConfirm)).toBe("function");
    await page.evaluate(() => { window.advanceSameAuth(); window.finishConfirm(true); });
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
    assert.deepEqual(await page.evaluate(() => window.calls), ["confirm"]);
  });
  await fixture(async page => {
    await page.evaluate(() => { window.confirmResult = true; window.holdRebase = true; });
    await page.getByRole("button", { name: "Проверить и перенести" }).click();
    await expect.poll(() => page.evaluate(() => typeof window.finishRebase)).toBe("function");
    await page.evaluate(() => { window.changeAuth("other-client"); window.finishRebase(); });
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
    assert.deepEqual(await page.evaluate(() => window.calls), ["confirm", ["rebase", "client", { confirmed: true }]]);
  });
});
