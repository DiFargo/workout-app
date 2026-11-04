import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import { getAccountRecoveryEmail } from "../src/features/client/profile/profileAccountEmail.js";
import { formatRussianCount } from "../src/utils/russianCount.js";

test("only reserved technical domains are hidden; real changed addresses stay available", () => {
  for (const value of ["user@invite.tren-85720.app", "user@telegram.tren-85720.app", "USER@INVITE.TREN-85720-STAGING.APP"]) assert.equal(getAccountRecoveryEmail(value), "");
  for (const value of ["user@example.com", "user@invite.example.com", "person@tren-85720.app"]) assert.equal(getAccountRecoveryEmail(value), value);
});

test("food counter uses Russian 1/2/5 and teen forms", () => {
  for (const [count, text] of [[0, "0 продуктов"], [1, "1 продукт"], [2, "2 продукта"], [5, "5 продуктов"], [11, "11 продуктов"], [14, "14 продуктов"], [21, "21 продукт"], [24, "24 продукта"], [112, "112 продуктов"]]) {
    assert.equal(formatRussianCount(count, ["продукт", "продукта", "продуктов"]), text);
  }
});

test("actual client components preserve unresolved voice data, truthful email and readable messages", { timeout: 60000 }, async t => {
  const path = name => JSON.stringify(fileURLToPath(new URL(`../src/${name}`, import.meta.url)).replaceAll("\\", "/"));
  const entry = "virtual:client-variant-a.jsx";
  const result = await build({ configFile: false, logLevel: "silent", plugins: [react(), {
    name: "bounded-client-ui-test", enforce: "pre",
    resolveId: id => id === entry ? `\0${entry}` : id.endsWith("/nutritionVoiceHandlers") ? "\0voice-transport" : null,
    load: id => id === "\0voice-transport" ? `export const loadNutritionVoiceMode=()=>false;export const createNutritionVoiceHandlers=deps=>({startNutritionVoiceCapture(){window.started=(window.started||0)+1;deps.setNutritionVoiceAddedItems(window.seedItems)},stopNutritionVoiceCapture(){},toggleNutritionVoiceMode(){}});`
      : id === `\0${entry}` ? `
      import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
      import Voice from ${path("features/client/nutrition/NutritionVoiceModal.jsx")};
      import Orbit from ${path("features/client/nutrition/NutritionOrbit.jsx")};
      import {useNutritionVoiceRuntime} from ${path("features/client/nutrition/useNutritionVoiceRuntime.js")};
      import Email from ${path("features/client/profile/ProfileEmailModal.jsx")};
      import Password from ${path("features/client/profile/ProfilePasswordModal.jsx")};
      import Connections from ${path("features/client/profile/ProfileAppSettingsSection.jsx")};
      import Notifications from ${path("features/client/profile/ProfileTrainerNotificationsModal.jsx")};
      import Meal from ${path("features/client/nutrition/NutritionMealModal.jsx")};
      import aiStyles from ${path("features/client/ai/AiCoachPage.module.css")};
      function VoiceCase(){const[open,setOpen]=useState(false);const runtime=useNutritionVoiceRuntime({nutritionMyFoods:[],addNutritionFood(food,meal,amount,options){window.attempts=(window.attempts||[]).concat(food.id);if(window.failIds?.includes(food.id))return false;window.added=(window.added||[]).concat(food.id);options?.onAdded?.({id:food.id,name:food.name,amount,calories:food.calories});return true;}});window.currentItems=runtime.nutritionVoiceAddedItems;window.directFinish=()=>runtime.finishNutritionVoiceResult({commit:true});window.tryStart=runtime.startNutritionVoiceCapture;return <><button onClick={()=>{runtime.startNutritionVoiceCapture();setOpen(true)}}>Seed voice</button><Voice open={open} feedback={runtime.nutritionVoiceFeedback} voiceAddedItems={runtime.nutritionVoiceAddedItems} onVoiceStart={runtime.startNutritionVoiceCapture} onVoiceDone={runtime.finishNutritionVoiceResult} onVoiceAddedItemRemove={runtime.removeNutritionVoiceAddedItem} onClose={()=>setOpen(false)}/></>}
      function OrbitCase(){return <Orbit voiceEnabled voiceAddedItems={[{id:'saved',name:'Already saved',amount:100}]} onVoiceDone={()=>{window.orbitCalls=(window.orbitCalls||0)+1;return window.orbitAllow}}/>}
      const root=createRoot(document.getElementById('root'));let key=0;window.show=(kind)=>root.render(<React.Fragment key={++key}>{kind==='voice'?<VoiceCase/>:kind==='orbit'?<OrbitCase/>:kind==='email'?<><Connections email='technical@invite.tren-85720.app' showTelegram={false} onOpenEmail={()=>{}}/><Email open email='technical@invite.tren-85720.app' onClose={()=>{}} onRequestEmailChange={()=>false}/></>:kind==='personal'?<Connections email='changed@example.com' showTelegram={false} onOpenEmail={()=>{}}/>:kind==='password'?<Password open canResetByEmail={false} onAddRecoveryEmail={()=>window.addEmail=true} onClose={()=>{}}/>:kind==='notifications'?<Notifications open activeCount={2} onClose={()=>{}} getTaskDestination={()=>''} tasks={[{id:'message',notificationType:'message',status:'progress',message:window.message},{id:'task',title:window.title,status:'progress'}]}/>:kind==='ai'?<div className={aiStyles.miniBlock}><h3>Анализ</h3><p>Длинный спокойный основной текст</p></div>:<Meal activeMeal={{name:'Завтрак'}} foods={[]} stats={{calories:0}} onClose={()=>{}}/>}</React.Fragment>);` : null
  }], build: { write: false, cssCodeSplit: false, minify: false, rollupOptions: { input: entry, output: { format: "iife" } } } });
  const css = result.output.filter(item => item.type === "asset" && item.fileName.endsWith(".css")).map(item => String(item.source)).join("\n");
  const js = result.output.filter(item => item.type === "chunk").map(item => item.code).join("\n");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
    page.setDefaultTimeout(3000);
    page.on("pageerror", error => console.error("UI regression runtime error:", error.message));
    await page.route("**/*", route => route.abort());
    await page.setContent('<html data-app-theme="warm-light"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:Arial}html{--app-viewport-height:874px;--apple-text:#1c282e;--apple-surface:#fff;--apple-secondary:#617078;--apple-blue:#3c6faa;--apple-action:#3f73b8}</style></head><body><div id="root"></div></body></html>');
    await page.addStyleTag({ content: css }); await page.addScriptTag({ content: js });
    const seed = async () => {
      await page.evaluate(() => { window.added=[];window.started=0;window.seedItems=[{id:"pending-tuna",kind:"candidate",query:"тунец",amount:100,mealId:"lunch",candidates:[{id:"tuna-water",name:"Тунец в собственном соку",calories:92},{id:"tuna-oil",name:"Тунец в масле",calories:198}]}];window.show("voice"); });
      await page.getByRole("button", { name: "Seed voice" }).click();
      await expect(page.getByTestId("nutrition-voice-done")).toHaveText("Уточнить продукты");
    };
    await t.test("Done and new recording cannot silently discard a pending voice item", async () => {
      await seed();
      assert.equal(await page.evaluate(() => window.directFinish()), false);
      await page.evaluate(() => window.tryStart());
      assert.equal(await page.evaluate(() => window.started), 1);
      assert.equal(await page.evaluate(() => window.currentItems.length), 1);
      await page.getByTestId("nutrition-voice-done").click();
      await expect(page.getByTestId("nutrition-voice-candidate").first()).toBeFocused();
      await expect(page.getByTestId("nutrition-voice-modal")).toBeVisible();
    });
    await t.test("explicit skip does not add food and allows completion", async () => {
      await page.getByTestId("nutrition-voice-skip").click();
      await expect(page.getByTestId("nutrition-voice-candidate")).toHaveCount(0);
      await page.getByTestId("nutrition-voice-done").click();
      await expect(page.getByTestId("nutrition-voice-modal")).toHaveCount(0);
      assert.deepEqual(await page.evaluate(() => window.added), []);
    });
    await t.test("resolving a candidate adds the selected food exactly once", async () => {
      await seed();await page.getByTestId("nutrition-voice-candidate").first().click();
      await expect(page.getByTestId("nutrition-voice-candidate")).toHaveCount(0);
      await page.getByTestId("nutrition-voice-done").click();
      assert.deepEqual(await page.evaluate(() => window.added), ["tuna-water"]);
    });
    await t.test("close requires explicit confirmation before discarding unresolved food", async () => {
      await seed();await page.getByTestId("nutrition-voice-close").click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
      await page.getByRole("button", { name: "Продолжить выбор" }).click();
      assert.equal(await page.evaluate(() => window.currentItems.length), 1);
      await page.getByTestId("nutrition-voice-close").click();
      await page.getByRole("button", { name: "Пропустить и закрыть" }).click();
      await expect(page.getByTestId("nutrition-voice-modal")).toHaveCount(0);
      assert.equal(await page.evaluate(() => window.currentItems.length), 0);
    });
    await t.test("technical email never appears as recovery inbox or prefilled new address", async () => {
      await page.evaluate(() => window.show("email"));
      await expect(page.getByText("Почта для восстановления не добавлена")).toBeVisible();
      await expect(page.getByTestId("profile-email-address")).toHaveValue("");
      assert.equal(await page.locator("body").textContent().then(text => text.includes("technical@")), false);
      await page.evaluate(() => window.show("personal"));
      await expect(page.getByText("changed@example.com · привязана")).toBeVisible();
      await page.evaluate(() => window.show("password"));
      await expect(page.getByTestId("profile-password-reset")).toHaveCount(0);
      await page.getByRole("button", { name: "Добавить личную почту", exact: true }).click();
      assert.equal(await page.evaluate(() => window.addEmail), true);
    });
    await t.test("partial review failure retains only failed foods and retry never adds successes twice", async () => {
      await page.evaluate(() => {
        window.added=[];window.attempts=[];window.failIds=['food-b'];
        window.seedItems=['a','b'].map(id=>({id:'review-'+id,kind:'review',name:'Review '+id,amount:100,mealId:'lunch',food:{id:'food-'+id,name:'Food '+id,calories:100}}));
        window.show('voice');
      });
      await page.getByRole('button', {name:'Seed voice'}).click();
      await expect(page.getByTestId('nutrition-voice-done')).toHaveText('Добавить в дневник');
      await page.getByTestId('nutrition-voice-done').click();
      await expect(page.getByTestId('nutrition-voice-modal')).toBeVisible();
      await expect(page.getByText('Не удалось добавить: 1. Уже добавленные продукты сохранены. Проверьте оставшиеся позиции и повторите.',{exact:true})).toBeVisible();
      assert.deepEqual(await page.evaluate(()=>window.currentItems.map(item=>item.id)),['review-b']);
      assert.deepEqual(await page.evaluate(()=>window.added),['food-a']);
      await page.evaluate(()=>{window.failIds=[]});
      await page.getByTestId('nutrition-voice-done').click();
      await expect(page.getByTestId('nutrition-voice-modal')).toHaveCount(0);
      assert.deepEqual(await page.evaluate(()=>window.added),['food-a','food-b']);
      assert.deepEqual(await page.evaluate(()=>window.attempts),['food-a','food-b','food-b']);
    });
    await t.test("NutritionOrbit preserves a false completion veto instead of closing the modal", async () => {
      await page.evaluate(()=>{window.orbitAllow=false;window.orbitCalls=0;window.show('orbit')});
      await page.getByTestId('nutrition-orbit-audio-search').click();
      await page.getByTestId('nutrition-voice-done').click();
      await expect(page.getByTestId('nutrition-voice-modal')).toBeVisible();
      assert.equal(await page.evaluate(()=>window.orbitCalls),1);
      await page.evaluate(()=>{window.orbitAllow=true});
      await page.getByTestId('nutrition-voice-done').click();
      await expect(page.getByTestId('nutrition-voice-modal')).toHaveCount(0);
      assert.equal(await page.evaluate(()=>window.orbitCalls),2);
    });
    await t.test("full notification text is reachable and task titles wrap on mobile", async () => {
      await page.evaluate(() => { window.message="Подробная рекомендация тренера. ".repeat(18)+"КОНЕЦ СООБЩЕНИЯ";window.title="Выполнить ближайшую тренировку и обязательно отметить самочувствие после неё";window.show("notifications"); });
      const summary=page.locator("details summary");await expect(summary).toBeVisible();
      await summary.click();await expect(page.locator("details[open] p")).toContainText("КОНЕЦ СООБЩЕНИЯ");
      assert.equal(await page.locator("details[open] p").evaluate(node => node.scrollWidth <= node.clientWidth+1), true);
      const title=page.getByText("Выполнить ближайшую тренировку и обязательно отметить самочувствие после неё", { exact: true });
      assert.equal(await title.evaluate(node => getComputedStyle(node).whiteSpace), "normal");
      await page.setViewportSize({width:320,height:568});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth), true);
    });
    await t.test("AI body typography is lighter than the headings in built CSS", async () => {
      await page.evaluate(() => window.show("ai"));
      const body=page.getByText("Длинный спокойный основной текст", { exact: true });await expect(body).toBeVisible();
      assert.equal(await body.evaluate(node=>getComputedStyle(node).fontWeight), "450");
      assert.equal(await page.locator("#root h3").evaluate(node=>getComputedStyle(node).fontWeight), "700");
    });
  } finally { await browser.close(); }
});
