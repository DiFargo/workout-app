import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { chromium, expect } from "@playwright/test";
import {
  consumeModalBackLayer, getModalBackLayerCount, registerModalBackLayer, subscribeModalBackLayers
} from "../src/shared/hooks/modalBackNavigation.js";

test("Back belongs to the top modal and cleanup restores the previous layer", () => {
  const calls = [];
  const snapshots = [];
  const unsubscribe = subscribeModalBackLayers(() => snapshots.push(getModalBackLayerCount()));
  const closeFirst = registerModalBackLayer(() => calls.push("first"));
  const closeSecond = registerModalBackLayer(() => calls.push("second"));
  try {
    assert.equal(consumeModalBackLayer(), true);
    assert.deepEqual(calls, ["second"]);
    closeSecond();
    assert.equal(consumeModalBackLayer(), true);
    assert.deepEqual(calls, ["second", "first"]);
    closeFirst();
    assert.equal(consumeModalBackLayer(), false);
    assert.deepEqual(snapshots, [1, 2, 1, 0]);
    closeFirst();
    assert.deepEqual(snapshots, [1, 2, 1, 0]);
  } finally { closeSecond(); closeFirst(); unsubscribe(); }
});

test("A busy layer consumes Back without dismissing or invoking the layer below", () => {
  let lowerCalls = 0;
  const closeFirst = registerModalBackLayer(() => lowerCalls++);
  const closeBusy = registerModalBackLayer(() => {});
  try {
    assert.equal(consumeModalBackLayer(), true);
    assert.equal(getModalBackLayerCount(), 2);
    assert.equal(lowerCalls, 0);
  } finally { closeBusy(); closeFirst(); }
});

const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url)).replaceAll("\\", "/");
const sceneBundle = await rolldown({ input: "confirm-back-scene", platform: "browser", transform: { jsx: { runtime: "automatic" } }, plugins: [{
  name: "actual-confirm-and-back-hooks",
  resolveId(id) { return id === "confirm-back-scene" ? id : null; },
  load(id) {
    if (id.endsWith(".css")) return { code: "export default new Proxy({}, { get: (_, key) => String(key) });", moduleType: "js" };
    if (id !== "confirm-back-scene") return null;
    return { moduleType: "jsx", code: `
      import React from 'react';import{createRoot}from'react-dom/client';
      import{showAppConfirm}from ${JSON.stringify(sourceRoot + "utils/appFeedback.js")};
      import{useAppBackNavigation}from ${JSON.stringify(sourceRoot + "shared/hooks/useAppBackNavigation.js")};
      import{useModalBackNavigation}from ${JSON.stringify(sourceRoot + "shared/hooks/useModalBackNavigation.js")};
      import{getModalBackLayerCount}from ${JSON.stringify(sourceRoot + "shared/hooks/modalBackNavigation.js")};
      let lowerBackCalls=0;const results=[],rejections=[];
      function open(label='test'){
        void showAppConfirm({title:'Подтвердить действие',text:label}).then(
          value=>results.push({label,value}),error=>rejections.push(error.message));
      }
      window.confirmScene={open,state:()=>({layers:getModalBackLayerCount(),lowerBackCalls,results:[...results],rejections:[...rejections]})};
      function Scene(){
        useAppBackNavigation({isLoggedIn:true,appLoading:false,page:'trainer',hasTransientScreen:false,
          isPrimaryPage:()=>false,handleTransientBack:()=>false});
        useModalBackNavigation({open:true,onBack:()=>{lowerBackCalls++;}});
        return <section role='dialog' aria-label='Занятый sheet'><button type='button' onClick={()=>open()}>Открыть подтверждение</button></section>;
      }
      createRoot(document.getElementById('root')).render(<Scene/>);
    ` };
  }
}] });
const generated = await sceneBundle.generate({ format: "iife", codeSplitting: false });
await sceneBundle.close();
const sceneCode = generated.output.find(item => item.type === "chunk").code;

async function confirmFixture(run) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(3000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => route.abort());
    await page.setContent('<main id="root"></main>');
    await page.addScriptTag({ content: sceneCode });
    await expect.poll(() => page.evaluate(() => window.confirmScene?.state().layers)).toBe(1);
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
const confirmDialog = page => page.getByRole("dialog", { name: "Подтвердить действие", exact: true });
const confirmState = page => page.evaluate(() => window.confirmScene.state());

test("Подтверждение поверх занятого sheet: Escape и browser Back закрывают только верхний слой и возвращают false один раз", { timeout: 30000 }, async () => {
  await confirmFixture(async page => {
    await page.getByRole("button", { name: "Открыть подтверждение", exact: true }).click();
    await expect.poll(async () => (await confirmState(page)).layers).toBe(2);
    await page.keyboard.press("Escape");
    await expect(confirmDialog(page)).toHaveCount(0);
    await expect.poll(async () => (await confirmState(page)).results).toEqual([{ label: "test", value: false }]);
    assert.deepEqual(await confirmState(page), { layers: 1, lowerBackCalls: 0, results: [{ label: "test", value: false }], rejections: [] });
    await page.keyboard.press("Escape");
    assert.equal((await confirmState(page)).lowerBackCalls, 1);
    assert.equal((await confirmState(page)).results.length, 1);

    await page.evaluate(() => window.confirmScene.open("back"));
    await expect.poll(async () => (await confirmState(page)).layers).toBe(2);
    await page.evaluate(() => window.history.back());
    await expect(confirmDialog(page)).toHaveCount(0);
    await expect.poll(async () => (await confirmState(page)).results).toEqual([{ label: "test", value: false }, { label: "back", value: false }]);
    assert.equal((await confirmState(page)).layers, 1);
    assert.equal((await confirmState(page)).lowerBackCalls, 1);
  });
});

test("Подтверждение: true/cancel, замена и ошибка открытия освобождают свой Back-слой", { timeout: 30000 }, async () => {
  await confirmFixture(async page => {
    await page.evaluate(() => window.confirmScene.open("confirm"));
    await confirmDialog(page).getByRole("button", { name: "Подтвердить", exact: true }).click();
    await expect.poll(async () => (await confirmState(page)).results).toEqual([{ label: "confirm", value: true }]);
    assert.equal((await confirmState(page)).layers, 1);
    await page.evaluate(() => window.confirmScene.open("cancel"));
    await confirmDialog(page).getByRole("button", { name: "Отмена", exact: true }).click();
    await expect.poll(async () => (await confirmState(page)).results.length).toBe(2);
    assert.deepEqual((await confirmState(page)).results.at(-1), { label: "cancel", value: false });
    assert.equal((await confirmState(page)).layers, 1);

    await page.evaluate(() => { window.confirmScene.open("replaced"); window.confirmScene.open("replacement"); });
    await expect(confirmDialog(page)).toHaveCount(1);
    await expect.poll(async () => (await confirmState(page)).results.length).toBe(3);
    assert.deepEqual((await confirmState(page)).results.at(-1), { label: "replaced", value: false });
    assert.equal((await confirmState(page)).layers, 2);
    await confirmDialog(page).getByRole("button", { name: "Отмена", exact: true }).click();
    await expect.poll(async () => (await confirmState(page)).results.length).toBe(4);
    assert.deepEqual((await confirmState(page)).results.at(-1), { label: "replacement", value: false });
    assert.equal((await confirmState(page)).layers, 1);

    await page.evaluate(() => {
      const originalFocus = HTMLElement.prototype.focus;
      HTMLElement.prototype.focus = function (...args) {
        if (this.textContent === "Отмена") { HTMLElement.prototype.focus = originalFocus; throw new Error("focus failed"); }
        return originalFocus.apply(this, args);
      };
      window.confirmScene.open("failed");
    });
    await expect.poll(async () => (await confirmState(page)).rejections).toEqual(["focus failed"]);
    await expect(confirmDialog(page)).toHaveCount(0);
    assert.equal((await confirmState(page)).layers, 1);
    await page.keyboard.press("Escape");
    assert.equal((await confirmState(page)).lowerBackCalls, 1);
    assert.equal((await confirmState(page)).results.length, 4);
  });
});
