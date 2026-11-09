import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { chromium, expect } from "@playwright/test";

const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url)).replaceAll("\\", "/");
// Keep real selectors/declarations, only unwrap the CSS Modules :global syntax.
// Importing mocked classes alone misses the 110000 !important trainer layer.
function browserCss(source) {
  let result = "", cursor = 0;
  while (true) {
    const start = source.indexOf(":global(", cursor);
    if (start < 0) return result + source.slice(cursor);
    result += source.slice(cursor, start);
    let end = start + 8, depth = 1;
    for (; end < source.length && depth; end++) {
      if (source[end] === "(") depth++;
      else if (source[end] === ")") depth--;
    }
    assert.equal(depth, 0, "CSS :global selector must close");
    result += source.slice(start + 8, end - 1);
    cursor = end;
  }
}
const actualCss = (await Promise.all([
  "components/trainer/TrainerClientUtilitySheet.module.css",
  "components/trainer/TrainerClientActionsSheet.module.css",
  "components/trainer/TrainerWorkspaceModalSystem.module.css",
  "shared/ui/ResponsiveModalLayer.module.css",
  "utils/appFeedback.module.css"
].map(path => readFile(sourceRoot + path, "utf8")))).map(browserCss).join("\n");

const bundle = await rolldown({ input: "admin-access-confirm-scene", platform: "browser", transform: { jsx: { runtime: "automatic" } }, plugins: [{
  name: "actual-admin-sheet-confirm-and-focus",
  resolveId(id) {
    if (id === "admin-access-confirm-scene") return id;
    if (id === "firebase/firestore") return "fixture-firestore";
    if (id.endsWith("/apiClient.js")) return "fixture-api-client";
    if (id.endsWith("/nutritionDayClient.js")) return "fixture-nutrition-client";
    return null;
  },
  load(id) {
    if (id.endsWith(".css")) return { code: "export default new Proxy({}, { get: (_, key) => String(key) });", moduleType: "js" };
    if (id === "fixture-firestore") return { moduleType: "js", code: `
      const unexpected=()=>{throw new Error('Unexpected Firebase call in offline fixture')};
      export const collection=unexpected,doc=unexpected,getDocs=unexpected,setDoc=unexpected,writeBatch=unexpected,
        query=unexpected,orderBy=unexpected,documentId=unexpected,startAfter=unexpected,limit=unexpected;
    ` };
    if (id === "fixture-api-client") return { moduleType: "js", code: "export const fetchAuthorizedWithTimeout=()=>{throw new Error('Unexpected network transport')};" };
    if (id === "fixture-nutrition-client") return { moduleType: "js", code: "export const clearNutritionProgress=()=>{throw new Error('Unexpected nutrition mutation')};" };
    if (id !== "admin-access-confirm-scene") return null;
    return { moduleType: "jsx", code: `
      import React,{useState}from'react';import{createRoot}from'react-dom/client';
      import TrainerClientActionsSheet from ${JSON.stringify(sourceRoot + "components/trainer/TrainerClientActionsSheet.jsx")};
      import{showAppConfirm}from ${JSON.stringify(sourceRoot + "utils/appFeedback.js")};
      import{useModalFocusTrap}from ${JSON.stringify(sourceRoot + "shared/hooks/useModalFocusTrap.js")};
      import{handleTrainerClientActionWithDeps}from ${JSON.stringify(sourceRoot + "features/trainer/trainerClientActionHandlers.js")};
      const auth={currentUser:{uid:'fixture-admin'}},initialClient={id:'fixture-client',role:'client',assignedProgramId:'individual-preserved'};
      const state={writes:0,results:[],statuses:[],client:initialClient,users:[initialClient],closed:false};
      let pending=null;
      window.adminAccessScene={state:()=>({...state,results:[...state.results],statuses:[...state.statuses]}),settle(kind){
        if(!pending)throw new Error('No access save pending');const {resolve,reject,allowed}=pending;pending=null;
        if(kind==='error')reject(Object.assign(new Error('server rejected'),{basicWorkoutAccessMessage:'Доступ не изменён. Повторно подтвердите вход ключом безопасности.'}));
        else resolve({basicWorkoutAccess:allowed,updatedAt:'server-confirmed'});
      }};
      function Scene(){
        useModalFocusTrap();const[client,setClient]=useState(initialClient),[status,setStatus]=useState(''),[open,setOpen]=useState(true);
        async function onAction(action){
          const result=await handleTrainerClientActionWithDeps({auth,db:{},client,action,showAppConfirm,
            canUseTrainerFeatures:()=>true,canUseAdminFeatures:()=>true,canManageClientProgram:()=>true,
            saveBasicWorkoutAccess:({allowed})=>{state.writes++;return new Promise((resolve,reject)=>{pending={resolve,reject,allowed}})},
            setAdminClientStatus:value=>{state.statuses.push(value);setStatus(value)},
            setAdminSelectedClient:update=>{setClient(previous=>{state.client=update(previous);return state.client})},
            setUsersList:update=>{state.users=update(state.users)}
          });state.results.push(result);return result;
        }
        return open?<TrainerClientActionsSheet clientName='Тестовый клиент' canDeleteClient showSchedule={false}
          basicWorkoutAccess={client.basicWorkoutAccess===true} status={status} onAction={onAction}
          onClose={()=>{state.closed=true;setOpen(false)}}/>:<p>Окно закрыто</p>;
      }
      createRoot(document.getElementById('root')).render(<Scene/>);
    ` };
  }
}] });
const generated = await bundle.generate({ format: "iife", codeSplitting: false });
await bundle.close();
const sceneCode = generated.output.find(item => item.type === "chunk").code;

async function fixture(run, { legacy = false, viewport = { width: 1280, height: 900 } } = {}) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport });
    page.setDefaultTimeout(4000);
    const errors = [], requests = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => { requests.push(route.request().url()); return route.abort(); });
    await page.setContent('<!doctype html><html data-trainer-variant="v2"><head><style>body{margin:0;font-family:Arial,sans-serif}*{box-sizing:border-box}</style></head><body><main id="root"></main></body></html>');
    await page.addStyleTag({ content: actualCss });
    if (legacy) await page.addStyleTag({ content: ".confirmOverlay{z-index:21000!important}" });
    await page.addScriptTag({ content: sceneCode });
    await expect(page.getByRole("dialog", { name: "Управление клиентом", exact: true })).toBeVisible();
    await run(page);
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, [], "fixture must not reach Production or any external endpoint");
  } finally { await browser.close(); }
}
const state = page => page.evaluate(() => window.adminAccessScene.state());
const sheet = page => page.locator('[data-trainer-modal-surface="true"]');
const confirm = page => page.getByRole("dialog", { name: "Открыть базовые тренировки?", exact: true });
const grant = page => sheet(page).getByRole("button", { name: /Открыть базовые тренировки/ });

async function openConfirmation(page) {
  await grant(page).click();
  await expect(confirm(page)).toBeVisible();
  await expect(sheet(page).locator('button[aria-busy="true"]')).toBeDisabled();
  await expect.poll(() => page.evaluate(() => document.querySelector('[data-trainer-modal-backdrop="true"]').inert)).toBe(true);
}
async function layerState(page) {
  return page.evaluate(() => {
    const overlay = document.querySelector(".confirmOverlay"), lower = document.querySelector('[data-trainer-modal-backdrop="true"]');
    const dialog = overlay.querySelector('[role="dialog"]'), button = [...dialog.querySelectorAll("button")].at(-1);
    const rect = button.getBoundingClientRect(), hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return { confirmZ: Number(getComputedStyle(overlay).zIndex), lowerZ: Number(getComputedStyle(lower).zIndex),
      focusedInConfirm: dialog.contains(document.activeElement), lowerInert: lower.inert, hitInConfirm: dialog.contains(hit) };
  });
}

test("Регрессия: прежний confirm 21000 рисуется под trainer sheet 110000, пока нижнее окно уже занято и inert", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await openConfirmation(page);
    const layers = await layerState(page);
    assert.equal(layers.confirmZ, 21000);
    assert.equal(layers.lowerZ, 110000);
    assert.ok(layers.confirmZ < layers.lowerZ, "sibling overlay is visually behind the trainer sheet despite later DOM position");
    assert.equal(layers.lowerInert, true);
    assert.equal(layers.focusedInConfirm, true, "keyboard focus moved to the visually obscured dialog");
    assert.equal((await state(page)).writes, 0, "the apparent hang happens before any server write");
    await page.keyboard.press("Escape");
    await expect(confirm(page)).toHaveCount(0);
    await expect(grant(page)).toBeEnabled();
  }, { legacy: true });
});

for (const viewport of [{ width: 1280, height: 900 }, { width: 393, height: 852 }]) {
  test(`Выдача доступа: подтверждение выше sheet, доступно кликом и разблокирует управление после ответа (${viewport.width}px)`, { timeout: 30000 }, async () => {
    await fixture(async page => {
      await openConfirmation(page);
      const layers = await layerState(page);
      assert.ok(layers.confirmZ > layers.lowerZ, `confirm ${layers.confirmZ} must paint above trainer ${layers.lowerZ}`);
      assert.equal(layers.hitInConfirm, true);
      assert.equal(layers.focusedInConfirm, true);
      await confirm(page).getByRole("button", { name: "Открыть доступ", exact: true }).click();
      await expect(confirm(page)).toHaveCount(0);
      await expect.poll(async () => (await state(page)).writes).toBe(1);
      await expect(sheet(page).locator('button[aria-busy="true"]')).toBeDisabled();
      await page.evaluate(() => window.adminAccessScene.settle("success"));
      await expect(sheet(page).getByRole("button", { name: /Базовые тренировки: доступны/ })).toBeEnabled();
      await expect.poll(async () => (await state(page)).results).toEqual([true]);
      const saved = await state(page);
      assert.equal(saved.client.basicWorkoutAccess, true);
      assert.equal(saved.client.assignedProgramId, "individual-preserved");
      assert.equal(saved.users[0].basicWorkoutAccess, true);
      await expect(sheet(page).getByRole("status")).toHaveText("Доступ к базовым тренировкам открыт.");
      await sheet(page).getByRole("button", { name: "Закрыть", exact: true }).click();
      await expect(sheet(page)).toHaveCount(0);
      assert.equal((await state(page)).closed, true);
    }, { viewport });
  });
}

test("Отмена подтверждения возвращает кнопки без выдачи доступа; отказ сервера снимает busy и оставляет повторную попытку", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await openConfirmation(page);
    await confirm(page).getByRole("button", { name: "Отмена", exact: true }).click();
    await expect(confirm(page)).toHaveCount(0);
    await expect(grant(page)).toBeEnabled();
    assert.equal((await state(page)).writes, 0);
    assert.deepEqual((await state(page)).results, [false]);
    await openConfirmation(page);
    await confirm(page).getByRole("button", { name: "Открыть доступ", exact: true }).click();
    await expect.poll(async () => (await state(page)).writes).toBe(1);
    await page.evaluate(() => window.adminAccessScene.settle("error"));
    await expect(grant(page)).toBeEnabled();
    await expect(sheet(page).getByText("Доступ не изменён. Повторно подтвердите вход ключом безопасности.", { exact: true })).toBeVisible();
    assert.equal((await state(page)).client.basicWorkoutAccess, undefined);
    assert.equal((await state(page)).client.assignedProgramId, "individual-preserved");
    await openConfirmation(page);
    await confirm(page).getByRole("button", { name: "Отмена", exact: true }).click();
    await expect(grant(page)).toBeEnabled();
  });
});
