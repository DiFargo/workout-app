import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { rolldown } from "rolldown";
import { chromium, expect } from "@playwright/test";

const source = name => JSON.stringify(resolve(`src/${name}`).replaceAll("\\", "/"));
const bundle = await rolldown({ input: "draft-recovery-scene", platform: "browser",
  transform: { jsx: { runtime: "automatic" } }, plugins: [{ name: "draft-recovery-browser-io",
    resolveId(id, importer) {
      if (["draft-recovery-scene", "fixture-auth", "fixture-firestore", "fixture-hook-react"].includes(id)) return id;
      if (id === "react" && /useWorkoutRuntimeEffects\.js$/.test(importer || "")) return "fixture-hook-react";
      if (id === "firebase/firestore") return "fixture-firestore";
      if (/\/firebase(?:\.js)?$/.test(id)) return "fixture-auth";
      return null;
    },
    load(id) {
      if (id.endsWith(".css")) return { code: "export default {};", moduleType: "js" };
      if (id === "fixture-auth") return "export const auth=window.fixtureAuth={currentUser:{uid:'draft-client'}};export const db={};";
      if (id === "fixture-firestore") return `
        export const doc=()=>{throw new Error('Firestore must not be called by draft recovery test')};
        export const writeBatch=()=>{throw new Error('Firestore must not be called by draft recovery test')};
      `;
      if (id === "fixture-hook-react") return `
        export {useRef,useEffect} from 'react';
        import {useState as realUseState} from 'react';
        export function useState(initial){const[value,set]=realUseState(initial);return[value,next=>{
          window.runtimeStateReports.push({uid:window.fixtureAuth.currentUser?.uid||''});set(next);
        }];}
      `;
      if (id !== "draft-recovery-scene") return null;
      return { moduleType: "jsx", code: `
        import React,{useCallback,useRef,useState}from'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';
        import{auth}from'fixture-auth';
        import{useWorkoutRuntimeEffects}from ${source("features/client/workouts/useWorkoutRuntimeEffects.js")};
        import{createWorkoutOpenHandlers}from ${source("features/client/workouts/workoutOpenHandlers.js")};
        import WorkoutListPage from ${source("features/client/workouts/WorkoutListPage.jsx")};
        import{readWorkoutDraft,saveWorkoutDraft,clearWorkoutDraft,getWorkoutDraftKey}from ${source("utils/workoutDraftStorage.js")};
        import{readWorkoutDraftFallback}from ${source("utils/workoutDraftFallbackStorage.js")};
        import{advanceAuthSession}from ${source("utils/authSession.js")};
        const noop=()=>{},params=new URLSearchParams(location.search),resume=params.has('resume');
        const id='workout-a',uid='draft-client',version='assignment-v1';
        const makePlan=(weight='37.5',note='Фактическая заметка')=>({assignedProgramUpdatedAt:version,assignedProgramName:'Программа восстановления',
          workouts:[{id,name:'Тренировка A',order:1,scheduledDate:'2026-10-31',assignedProgramUpdatedAt:version,
            exercises:[{id:'exercise-a',name:'Приседание',requiresWeight:true,exerciseCardId:'card-a',exerciseCardOwnerUid:'trainer-a',
              video:'protected/video-a',videoPoster:'protected/poster-a',videoCrop:{x:0.4,y:0.6,scale:1.2},note,
              sets:[{id:'set-a',reps:10,weight:35,enteredWeight:weight,enteredReps:'12',completed:true},
                {id:'set-b',reps:10,weight:35,enteredWeight:'',enteredReps:'',completed:false}]}]}]});
        const originalSet=Storage.prototype.setItem,nativeFactory=window.indexedDB,nativePut=IDBObjectStore.prototype.put;
        window.runtimeStateReports=[];window.webStorageDenied=!resume;window.failIdbWrites=false;
        window.io={held:false,released:false,openRequests:[],puts:[],commits:[],
          restoreIndexedDB:()=>Object.defineProperty(window,'indexedDB',{configurable:true,value:nativeFactory})};
        Storage.prototype.setItem=function(...args){if(window.webStorageDenied)throw new DOMException('Synthetic real Web Storage quota','QuotaExceededError');
          return originalSet.apply(this,args)};
        IDBObjectStore.prototype.put=function(...args){if(window.failIdbWrites)throw new DOMException('Synthetic IndexedDB quota','QuotaExceededError');
          const request=nativePut.apply(this,args);
          if(this.name==='drafts'&&typeof args[0]?.payload==='string'){const draft=JSON.parse(args[0].payload);window.io.puts.push(draft);
            this.transaction.addEventListener('complete',()=>window.io.commits.push(draft));}return request;};
        if(!resume){const old={uid,workoutId:id,assignmentVersion:version,plan:makePlan('20','Старый локальный черновик'),
          savedAt:params.has('same-ms')?new Date().toISOString():'2026-10-31T08:00:00.000Z',workoutStartedAt:1793433600000,currentExerciseIndex:0};
          originalSet.call(localStorage,getWorkoutDraftKey(uid,id),JSON.stringify(old));}
        if(params.has('deny'))Object.defineProperty(window,'indexedDB',{configurable:true,value:undefined});
        if(params.has('hold')){const open=IDBFactory.prototype.open;IDBFactory.prototype.open=function(...args){
          if(window.io.released)return open.apply(this,args);
          const actual=open.apply(this,args),delayed={};
          actual.onupgradeneeded=()=>{delayed.result=actual.result;delayed.transaction=actual.transaction;delayed.onupgradeneeded?.()};
          actual.onerror=()=>delayed.onerror?.();actual.onsuccess=()=>{delayed.result=actual.result;window.io.held=true;
            if(window.io.released)delayed.onsuccess?.();else window.io.openRequests.push(delayed);};return delayed;};
          window.io.release=()=>{window.io.released=true;window.io.openRequests.splice(0).forEach(request=>request.onsuccess?.())};}
        let current,setPlanState,setRuntimeState,setUserState,currentHandlers,root;
        function App(){
          const[user,setUser]=useState(auth.currentUser),[plan,setPlan]=useState(()=>resume?makePlan('','План тренера'):makePlan());
          const[runtime,setRuntime]=useState({started:!resume,startedAt:resume?null:Date.now()-60000,finishedAt:null,currentExerciseIndex:1,
            comment:resume?'':'Комментарий клиента',warmupCompletedSteps:[0],warmupTimerDuration:300,warmupTimerSeconds:120,
            restTimerDuration:90,restTimerSeconds:17,readiness:{id:'good'},postWorkoutFeedback:null});
          const[prompt,setPrompt]=useState(null),[individualIndex,setIndividualIndex]=useState(0),[indexReady,setIndexReady]=useState(false);
          const setRestSeconds=useCallback(value=>setRuntime(before=>{const next=typeof value==='function'?value(before.restTimerSeconds):value;
            return next===before.restTimerSeconds?before:{...before,restTimerSeconds:next}}),[]);
          const inline=useRef(null),tick=useRef(0),setField=name=>value=>setRuntime(before=>({...before,[name]:value}));
          const handlers=createWorkoutOpenHandlers({APP_PAGES:{WORKOUTS:'workouts',HISTORY:'history'},STORAGE_KEY:'workout',auth,db:{},user,
            plan,history:[],workoutDraftRestorePrompt:prompt,loadHistory:noop,loadWorkoutsFromFirebase:async()=>plan,setPlan,
            setSelectedWorkoutId:noop,setPage:noop,setOpenVideoId:noop,setFullscreenVideo:noop,setCurrentExerciseIndex:setField('currentExerciseIndex'),
            setWorkoutStarted:setField('started'),setWorkoutStartedAt:setField('startedAt'),setWorkoutFinishedAt:setField('finishedAt'),
            setWorkoutReadiness:setField('readiness'),setWorkoutReadinessPending:noop,setWarmupCompletedSteps:setField('warmupCompletedSteps'),
            setWarmupTimerDuration:setField('warmupTimerDuration'),setWarmupTimerSeconds:setField('warmupTimerSeconds'),setWarmupTimerRunning:noop,
            setRestTimerDuration:setField('restTimerDuration'),setRestTimerSeconds:setField('restTimerSeconds'),setRestTimerRunning:noop,
            setExerciseHistoryOpenId:noop,setWorkoutHistorySyncState:noop,setWorkoutExitPromptOpen:noop,setPostWorkoutFeedback:setField('postWorkoutFeedback'),
            setPostWorkoutFeedbackOpen:noop,setWorkoutReadinessOpen:noop,setIsWorkoutSaved:noop,setWorkoutClientComment:setField('comment'),
            setShowWorkoutSavedCard:noop,setWorkoutDraftRestorePrompt:setPrompt});
          const{workoutDraftSaveWarning}=useWorkoutRuntimeEffects({auth,user,plan,selectedWorkoutId:id,workout:plan.workouts[0],
            currentExerciseIndex:runtime.currentExerciseIndex,inlineVideoControlsTimerRef:inline,isWorkoutSaved:false,
            postWorkoutFeedback:runtime.postWorkoutFeedback,restTimerDuration:runtime.restTimerDuration,
            restTimerRunning:params.has('countdown')&&runtime.restTimerSeconds>0,restTimerSeconds:runtime.restTimerSeconds,
            timerTickRef:tick,warmupCompletedSteps:runtime.warmupCompletedSteps,warmupTimerDuration:runtime.warmupTimerDuration,
            warmupTimerRunning:false,warmupTimerSeconds:runtime.warmupTimerSeconds,workoutFinishedAt:runtime.finishedAt,
            workoutReadiness:runtime.readiness,workoutStarted:runtime.started,workoutStartedAt:runtime.startedAt,workoutClientComment:runtime.comment,
            workoutVideoCacheKey:'',setExerciseHistoryOpenId:noop,setExerciseNoteOpenId:noop,setExerciseTechniqueOpenId:noop,
            setExerciseValidationMessage:noop,setCurrentExerciseIndex:noop,setInlinePlayingVideoId:noop,setInlineVideoControlsVisible:noop,
            setRestTimerRunning:noop,setRestTimerSeconds:params.has('countdown')?setRestSeconds:noop,
            setTimerTick:noop,setVideoLoadingId:noop,setWarmupTimerRunning:noop,setWarmupTimerSeconds:noop});
          current={plan,runtime,prompt,warning:workoutDraftSaveWarning};setPlanState=setPlan;setRuntimeState=setRuntime;setUserState=setUser;currentHandlers=handlers;
          return <><output data-testid='draft-warning'>{workoutDraftSaveWarning}</output>
            {resume&&<WorkoutListPage appVersion='test' renderClientMainBottomBar={()=>null} plan={plan} history={[]} currentUserId={user?.uid||''}
              workoutModePreference={{mode:'individual'}} individualWorkoutIndex={individualIndex} individualWorkoutIndexInitialized={indexReady}
              setIndividualWorkoutIndex={setIndividualIndex} setIndividualWorkoutIndexInitialized={setIndexReady}
              workoutHistoryModalOpen={false} setWorkoutHistoryModalOpen={noop} workoutDraftRestorePrompt={prompt} workoutReadinessOpen={false}
              postWorkoutFeedbackOpen={false} fullscreenVideo={null} showFirstSetupOnboarding={false} historyLoading={false}
              loadHistory={noop} onGoMain={noop} onOpenTraining={noop} onOpenNutrition={noop} onOpenCabinet={noop}
              onOpenBasicMode={noop} openWorkout={handlers.openWorkout} handleWorkoutDraftChoice={handlers.handleWorkoutDraftChoice}/>}</>;
        }
        root=createRoot(document.getElementById('root'));flushSync(()=>root.render(<App/>));
        window.scene={current:()=>current,read:()=>readWorkoutDraft(uid,id),fallback:()=>readWorkoutDraftFallback(uid,id),
          local:()=>JSON.parse(localStorage.getItem(getWorkoutDraftKey(uid,id))),
          edit:(weight='45',note='Новый локальный ввод')=>flushSync(()=>{setPlanState(makePlan(weight,note));
            setRuntimeState(before=>({...before,comment:'Новый комментарий'}))}),
          focus:()=>window.dispatchEvent(new Event('focus')),open:()=>currentHandlers.openWorkout(id),
          advanceSession:()=>advanceAuthSession(auth),switchUser:()=>{auth.currentUser={uid:'other-client'};advanceAuthSession(auth);
            flushSync(()=>{setUserState(auth.currentUser);setRuntimeState(before=>({...before,started:false}))})},
          clear:()=>{flushSync(()=>setRuntimeState(before=>({...before,started:false})));clearWorkoutDraft(uid,id)},
          unmount:()=>flushSync(()=>root.unmount()),save:saveWorkoutDraft};window.ready=true;
      ` };
    }
  }] });
const generated = await bundle.generate({ format: "iife", codeSplitting: false });
await bundle.close();
const code = generated.output.find(item => item.type === "chunk").code;

async function fixture(run, query = "") {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => route.request().url().startsWith("https://draft-recovery.test/")
      ? route.fulfill({ contentType: "text/html", body: '<meta name="viewport" content="width=device-width,initial-scale=1"><main id="root"></main>' })
      : route.abort());
    await page.goto(`https://draft-recovery.test/${query}`);
    await page.clock.install({ time: new Date("2026-10-31T10:00:00.000Z") });
    await page.clock.pauseAt(new Date("2026-10-31T10:00:01.000Z"));
    await page.addScriptTag({ content: code });
    await page.waitForFunction(() => window.ready);
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

test("восстановление: quota Web Storage → durable IndexedDB → холодный запуск → реальная кнопка продолжения и restore", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await expect.poll(() => page.evaluate(async () => Boolean(await window.scene.fallback()))).toBe(true);
    await expect(page.getByTestId("draft-warning")).toHaveText("");
    const saved = await page.evaluate(() => window.scene.read());
    assert.equal(saved.plan.workouts[0].exercises[0].sets[0].enteredWeight, "37.5");
    assert.equal(saved.plan.workouts[0].exercises[0].sets[0].completed, true);
    assert.equal(saved.plan.workouts[0].exercises[0].note, "Фактическая заметка");
    assert.equal(await page.evaluate(() => window.scene.local().plan.workouts[0].exercises[0].sets[0].enteredWeight), "20");

    await page.goto("https://draft-recovery.test/?resume=1");
    await page.addScriptTag({ content: code });
    await page.waitForFunction(() => window.ready);
    assert.deepEqual(await page.evaluate(() => window.scene.read()), saved);
    await page.getByRole("button", { name: "Продолжить тренировку", exact: true }).click();
    const dialog = page.getByTestId("workout-draft-restore-dialog");
    await expect(dialog).toBeVisible();
    assert.equal(await page.evaluate(() => window.scene.current().prompt.savedDraft.savedAt), saved.savedAt);
    await dialog.getByRole("button", { name: "Продолжить тренировку", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const restored = await page.evaluate(() => window.scene.current());
    assert.equal(restored.runtime.started, true);
    assert.equal(restored.runtime.comment, "Комментарий клиента");
    assert.equal(restored.runtime.restTimerSeconds, 17);
    assert.deepEqual(restored.plan.workouts[0].exercises[0].sets, saved.plan.workouts[0].exercises[0].sets);
    assert.equal(restored.plan.workouts[0].exercises[0].note, "Фактическая заметка");
    assert.equal(restored.plan.workouts[0].exercises[0].video, "protected/video-a");
    assert.equal(restored.plan.workouts[0].exercises[0].videoPoster, "protected/poster-a");
    assert.deepEqual(restored.plan.workouts[0].exercises[0].videoCrop, { x: 0.4, y: 0.6, scale: 1.2 });

    await page.clock.runFor(1000);
    await page.evaluate(() => { window.webStorageDenied = false; window.scene.edit(); });
    await expect.poll(() => page.evaluate(() => window.scene.local().plan.workouts[0].exercises[0].sets[0].enteredWeight)).toBe("45");
    const newest = await page.evaluate(() => window.scene.read());
    assert.equal(newest.plan.workouts[0].exercises[0].sets[0].enteredWeight, "45");
    assert.equal(newest.plan.workouts[0].exercises[0].note, "Новый локальный ввод");
    await expect(page.getByTestId("draft-warning")).toHaveText("");
  });
});

test("восстановление: отказ обоих хранилищ оставляет предупреждение, повтор успешной durable записи очищает его", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await expect(page.getByTestId("draft-warning")).toContainText("Не удалось сохранить тренировку на устройстве");
    await page.clock.runFor(1000);
    await expect(page.getByTestId("draft-warning")).toContainText("Не закрывайте приложение");
    assert.equal(await page.evaluate(() => window.scene.read().then(() => "unexpected success", error => error.message)),
      "workout_draft_fallback_unavailable");
    await page.evaluate(() => { window.io.restoreIndexedDB(); window.scene.focus(); });
    await expect.poll(() => page.evaluate(async () => Boolean(await window.scene.fallback()))).toBe(true);
    await expect(page.getByTestId("draft-warning")).toHaveText("");
    assert.equal(await page.evaluate(() => window.scene.read().then(draft => draft.workoutClientComment)), "Комментарий клиента");
  }, "?deny=1");
});

test("восстановление: countdown и правки каждую секунду не скрывают pending warning и не накапливают очередь", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await page.waitForFunction(() => window.io.held);
    await page.clock.runFor(299);
    await expect(page.getByTestId("draft-warning")).toHaveText("");
    await page.clock.runFor(1);
    await expect(page.getByTestId("draft-warning")).toContainText("Не удалось сохранить тренировку на устройстве");
    for (let second = 1; second <= 6; second++) {
      await page.clock.runFor(second === 1 ? 700 : 1000);
      await page.evaluate(second => window.scene.edit(String(40 + second), `Правка ${second}`), second);
      await expect(page.getByTestId("draft-warning")).toContainText("Не закрывайте приложение");
    }
    await page.waitForFunction(() => window.io.openRequests.length >= 2);
    assert.equal(await page.evaluate(() => window.scene.current().runtime.restTimerSeconds), 11);
    assert.equal(await page.evaluate(() => window.io.puts.length), 0);

    const latest = await page.evaluate(() => { window.io.release(); return window.scene.read(); });
    assert.equal(latest.plan.workouts[0].exercises[0].sets[0].enteredWeight, "46");
    assert.equal(latest.plan.workouts[0].exercises[0].note, "Правка 6");
    assert.equal(latest.restTimerSeconds, 11);
    const writes = await page.evaluate(() => window.io.commits.map(draft => draft.plan.workouts[0].exercises[0].sets[0].enteredWeight));
    assert.ok(writes.length >= 1 && writes.length <= 2, `Expected one in-flight and one latest write, got ${JSON.stringify(writes)}`);
    assert.equal(writes.at(-1), "46");
    assert.equal(await page.evaluate(() => window.io.puts.length), writes.length);
    await expect(page.getByTestId("draft-warning")).toHaveText("");
  }, "?hold=1&countdown=1");
});

test("восстановление: clear отменяет накопленный latest и не допускает воскрешения после позднего commit", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await page.waitForFunction(() => window.io.held);
    await page.evaluate(() => {
      for (let revision = 1; revision <= 20; revision++) window.scene.edit(String(40 + revision), `Отменённая правка ${revision}`);
      window.scene.clear();
      window.io.release();
    });
    assert.equal(await page.evaluate(() => window.scene.read()), null);
    assert.equal(await page.evaluate(() => window.scene.local()), null);
    assert.equal(await page.evaluate(() => window.scene.fallback()), null);
    assert.ok(await page.evaluate(() => window.io.puts.length) <= 1);

    await page.goto("https://draft-recovery.test/?resume=1");
    await page.addScriptTag({ content: code });
    await page.waitForFunction(() => window.ready);
    assert.equal(await page.evaluate(() => window.scene.read()), null);
    await expect(page.getByRole("button", { name: "Продолжить тренировку", exact: true })).toHaveCount(0);
  }, "?hold=1");
});

test("восстановление: в ту же миллисекунду fallback новее старого local, затем local recovery новее fallback", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await expect.poll(() => page.evaluate(async () => Boolean(await window.scene.fallback()))).toBe(true);
    const first = await page.evaluate(async () => ({ now: Date.now(), local: window.scene.local(), fallback: await window.scene.fallback(),
      restored: await window.scene.read() }));
    assert.equal(first.now, Date.parse(first.local.savedAt));
    assert.ok(Date.parse(first.fallback.savedAt) > Date.parse(first.local.savedAt));
    assert.equal(first.restored.plan.workouts[0].exercises[0].sets[0].enteredWeight, "37.5");

    await page.evaluate(() => { window.webStorageDenied = false; window.scene.edit("52.5", "Сохранено в ту же миллисекунду"); });
    const second = await page.evaluate(async () => ({ now: Date.now(), local: window.scene.local(), fallback: await window.scene.fallback(),
      restored: await window.scene.read() }));
    assert.equal(second.now, first.now);
    assert.ok(Date.parse(second.local.savedAt) > Date.parse(second.fallback.savedAt));
    assert.equal(second.restored.plan.workouts[0].exercises[0].sets[0].enteredWeight, "52.5");
    assert.equal(second.restored.plan.workouts[0].exercises[0].note, "Сохранено в ту же миллисекунду");
    await expect(page.getByTestId("draft-warning")).toHaveText("");
  }, "?same-ms=1");
});

test("восстановление: успешный local write отменяет pending latest и побеждает поздний старый fallback", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await page.waitForFunction(() => window.io.held);
    await page.evaluate(() => {
      for (let revision = 1; revision <= 20; revision++) window.scene.edit(String(40 + revision), `Pending ${revision}`);
      window.webStorageDenied = false;
      window.scene.edit("72.5", "Новый durable local");
      window.io.release();
    });
    const result = await page.evaluate(async () => ({ restored: await window.scene.read(), local: window.scene.local(),
      fallback: await window.scene.fallback(), puts: window.io.puts.length }));
    assert.equal(result.restored.plan.workouts[0].exercises[0].sets[0].enteredWeight, "72.5");
    assert.equal(result.restored.plan.workouts[0].exercises[0].note, "Новый durable local");
    assert.ok(Date.parse(result.local.savedAt) > Date.parse(result.fallback.savedAt));
    assert.equal(result.puts, 1);
    await expect(page.getByTestId("draft-warning")).toHaveText("");
  }, "?hold=1&same-ms=1");
});

for (const [name, action] of [["смены auth UID", "switchUser"], ["смены auth-сессии того же UID", "advanceSession"], ["unmount", "unmount"]]) {
  for (const shouldFail of [true, false]) {
    test(`восстановление: поздний ${shouldFail ? "отказ" : "успех"} IndexedDB после ${name} не публикует состояние hook`, { timeout: 30000 }, async () => {
      await fixture(async page => {
        await page.waitForFunction(() => window.io.held);
        await page.evaluate(({ action, shouldFail }) => {
          window.scene[action]();
          window.runtimeStateReports.length = 0;
          window.failIdbWrites = shouldFail;
          window.io.release();
        }, { action, shouldFail });
        assert.equal(await page.evaluate(() => window.scene.fallback().then(Boolean)), !shouldFail);
        assert.deepEqual(await page.evaluate(() => window.runtimeStateReports), []);
        if (action !== "unmount") await expect(page.getByTestId("draft-warning")).toHaveText("");
      }, "?hold=1");
    });
  }
}
