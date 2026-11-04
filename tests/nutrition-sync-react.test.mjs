import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { rolldown } from "rolldown";
import { chromium } from "playwright";

const absolute = file => resolve(file).replaceAll("\\", "/");
const bundle = await rolldown({ input: "nutrition-sync-probe", platform: "browser", transform: { jsx: { runtime: "automatic" } }, plugins: [{
  name: "nutrition-sync-io-only",
  resolveId(id) {
    if (["nutrition-sync-probe", "probe-firebase", "probe-firestore"].includes(id)) return id;
    if (id === "firebase/firestore") return "probe-firestore";
    if (/\/firebase(?:\.js)?$/.test(id)) return "probe-firebase";
    return null;
  },
  load(id) {
    if (id === "probe-firebase") return "export const auth={currentUser:{uid:'synthetic'}};export const db={};";
    if (id === "probe-firestore") return `
      export const io=window.io={docs:{},reads:0,transactions:0,sets:0,storageWrites:0,fail:false,holdReply:false,releases:[]};
      export const doc=(_, ...p)=>p.join('/');
      const snap=path=>({exists:()=>Object.hasOwn(io.docs,path),data:()=>structuredClone(io.docs[path])});
      export const getDoc=async path=>{io.reads++;return snap(path)};
      export const runTransaction=async(_,callback)=>{io.transactions++;if(io.fail)throw new Error('synthetic offline');
        const hold=io.holdReply;io.holdReply=false;
        const result=await callback({get:async path=>snap(path),set:(path,data)=>{io.sets++;io.docs[path]=structuredClone(data)}});
        if(hold)await new Promise(resolve=>io.releases.push(resolve));return result;
      };
    `;
    if (id === "nutrition-sync-probe") return { moduleType: "jsx", code: `
      import React,{useRef,useState,useMemo}from'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';
      import{auth,db}from'probe-firebase';import{io}from'probe-firestore';
      import{createNutritionCloudLoader}from${JSON.stringify(absolute("src/features/client/nutrition/nutritionCloudLoader.js"))};
      import{useNutritionRuntimeEffects}from${JSON.stringify(absolute("src/features/client/nutrition/useNutritionRuntimeEffects.js"))};
      import{mergeNutritionStates}from${JSON.stringify(absolute("src/utils/nutritionStateMerge.js"))};
      import{stampNutritionDayChange}from${JSON.stringify(absolute("src/utils/nutritionSyncModel.js"))};
      import{getFailedNutritionSync,setFailedNutritionSync}from${JSON.stringify(absolute("src/utils/offlineSyncStorage.js"))};
      import{isNutritionStateDirty}from${JSON.stringify(absolute("src/utils/nutritionSyncRevision.js"))};
      const noop=()=>{}, path='users/synthetic/nutrition/state',personal='users/synthetic/nutrition/myFoods';
      const at='2026-10-01T09:00:00Z';
      let initial=mergeNutritionStates({}, {updatedAt:at,days:{today:{updatedAt:at,water:1500,foods:[{id:'portion',updatedAt:at,calories:100}],deletedFoods:{},fieldUpdatedAt:{water:at}}}});
      initial=mergeNutritionStates(initial,initial);
      io.docs[path]={...initial,__uid:'synthetic'};delete io.docs[path].myFoods;
      io.docs[personal]={myFoods:{},deletedMyFoods:{},ownerUid:'synthetic',updatedAt:at};
      const rawSet=Storage.prototype.setItem;Storage.prototype.setItem=function(...args){io.storageWrites++;return rawSet.apply(this,args)};
      let latest,loader,setCurrent,setPage;
      function App(){const[nutrition,setNutrition]=useState({}),[ready,setReady]=useState(false),[page,changePage]=useState('nutrition');
        const undo=useRef(null),video=useRef(null);setCurrent=setNutrition;setPage=changePage;latest=nutrition;
        const handlers=useMemo(()=>createNutritionCloudLoader({auth,db,NUTRITION_STORAGE_KEY:'n',startPerformanceCheck:noop,endPerformanceCheck:noop,
          showAppError:noop,setNutrition,setNutritionCloudReady:setReady}),[]);loader=handlers.loadNutritionFromFirebase;
        useNutritionRuntimeEffects({auth,user:auth.currentUser,page,nutrition,nutritionCloudReady:ready,nutritionStorageKey:'n',nutritionBackupStorageKey:'b',
          nutritionUndoTimerRef:undo,barcodeVideoRef:video,barcodeScannerOpen:false,barcodeSearchEnabled:false,setNutrition,loadNutritionFromFirebase:loader,
          showAppError:noop,setBarcodeScannerError:noop,setBarcodeScannerOpen:noop,setNutritionBarcode:noop});
        return <output data-ready={String(ready)}/>;
      }
      const root=createRoot(document.getElementById('root'));flushSync(()=>root.render(<App/>));
      window.probe={hydrate:()=>loader('synthetic'),page:value=>flushSync(()=>setPage(value)),
        edit:water=>flushSync(()=>setCurrent(current=>{const now=new Date(Date.now()+water).toISOString();return{...current,updatedAt:now,
          days:{...current.days,today:stampNutritionDayChange(current.days.today,{...current.days.today,water,foods:[]},now)}}})),
        queueBeforeHydrate(){const now='2026-10-25T08:00:00Z';setFailedNutritionSync('synthetic',{...initial,__uid:'synthetic',updatedAt:now,
          days:{today:stampNutritionDayChange(initial.days.today,{...initial.days.today,water:2200,foods:[]},now)}})},
        snapshot:()=>({nutrition:latest,dirty:isNutritionStateDirty(auth,latest),queue:getFailedNutritionSync('synthetic'),
          reads:io.reads,transactions:io.transactions,sets:io.sets,storageWrites:io.storageWrites,backup:JSON.parse(localStorage.getItem('b:synthetic')||'[]'),
          cloud:io.docs[path],held:io.releases.length}),
        fail:value=>io.fail=value,hold:()=>io.holdReply=true,release:()=>io.releases.splice(0).forEach(fn=>fn()),unmount:()=>flushSync(()=>root.unmount())};
    ` };
    return null;
  }
}] });
const generated = await bundle.generate({ format: "iife", codeSplitting: false });
await bundle.close();
const code = generated.output.find(item => item.type === "chunk").code;

test("реальные React effects: нет echo-save, scoped refresh, offline queue и старый ack сохраняют новые edits", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  async function pageForCase() {
    const page = await browser.newPage();
    await page.route("**/*", route => route.request().url() === "https://nutrition-sync.test/"
      ? route.fulfill({ contentType: "text/html", body: '<main id="root"></main>' }) : route.abort());
    await page.goto("https://nutrition-sync.test/");
    await page.clock.install({ time: new Date("2026-10-25T09:00:00Z") });
    await page.addScriptTag({ content: code });
    return page;
  }
  const snapshot = page => page.evaluate(() => window.probe.snapshot());
  try {
    const clean = await pageForCase();
    await clean.evaluate(() => window.probe.hydrate());
    await clean.clock.runFor(20);
    assert.equal(await clean.locator('output').getAttribute('data-ready'), 'true');
    await clean.clock.runFor(2700);
    const hydrated = await snapshot(clean);
    assert.equal(hydrated.transactions, 0);
    assert.equal(hydrated.dirty, false);
    assert.equal(hydrated.backup.length, 1);
    assert.equal(hydrated.storageWrites, 2);
    await clean.clock.runFor(60000);
    const refreshed = await snapshot(clean);
    assert.equal(refreshed.reads, 4);
    assert.equal(refreshed.transactions, 0);
    assert.equal(refreshed.storageWrites, hydrated.storageWrites);
    await clean.evaluate(() => window.probe.page('workouts'));
    await clean.clock.runFor(120000);
    await clean.evaluate(() => window.dispatchEvent(new Event('focus')));
    assert.equal((await snapshot(clean)).reads, 4);
    await clean.close();

    const queued = await pageForCase();
    await queued.evaluate(() => { window.probe.queueBeforeHydrate(); return window.probe.hydrate(); });
    await queued.clock.runFor(20);
    assert.equal(await queued.locator('output').getAttribute('data-ready'), 'true');
    await queued.clock.runFor(2700);
    const restored = await snapshot(queued);
    assert.equal(restored.transactions, 1);
    assert.equal(restored.cloud.days.today.water, 2200);
    assert.equal(restored.cloud.days.today.foods.length, 0);
    assert.ok(restored.cloud.days.today.deletedFoods.portion);
    assert.equal(restored.queue, null);
    assert.equal(restored.dirty, false);
    await queued.clock.runFor(60000);
    assert.equal((await snapshot(queued)).transactions, 1, "reconnect/refresh не создаёт echo после ack");
    await queued.close();

    const race = await pageForCase();
    await race.evaluate(() => window.probe.hydrate());
    await race.clock.runFor(20);
    assert.equal(await race.locator('output').getAttribute('data-ready'), 'true');
    await race.evaluate(() => { window.probe.hold(); window.probe.edit(2000); });
    assert.ok((await snapshot(race)).queue, "edit немедленно попадает в durable queue до autosave debounce");
    await race.clock.runFor(700);
    assert.equal((await snapshot(race)).held, 1);
    await race.evaluate(() => window.probe.edit(2100));
    await race.clock.runFor(700);
    assert.equal((await snapshot(race)).cloud.days.today.water, 2100);
    await race.evaluate(() => window.probe.release());
    await race.clock.runFor(2700);
    const afterOldAck = await snapshot(race);
    assert.equal(afterOldAck.nutrition.days.today.water, 2100);
    assert.equal(afterOldAck.dirty, false);
    assert.equal(afterOldAck.queue, null);
    assert.equal(afterOldAck.transactions, 2);
    await race.close();

    const offline = await pageForCase();
    await offline.evaluate(() => window.probe.hydrate());
    await offline.clock.runFor(20);
    assert.equal(await offline.locator('output').getAttribute('data-ready'), 'true');
    await offline.evaluate(() => { window.probe.fail(true); window.probe.edit(2300); });
    await offline.clock.runFor(700);
    assert.ok((await snapshot(offline)).queue);
    await offline.evaluate(() => { window.probe.fail(false); return window.probe.hydrate(); });
    await offline.clock.runFor(2700);
    const recovered = await snapshot(offline);
    assert.equal(recovered.queue, null);
    assert.equal(recovered.cloud.days.today.water, 2300);
    assert.ok(recovered.cloud.days.today.deletedFoods.portion);
    await offline.close();
  } finally { await browser.close(); }
});
