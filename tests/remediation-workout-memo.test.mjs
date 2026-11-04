import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { chromium, expect } from "@playwright/test";

const hookPath = JSON.stringify(fileURLToPath(new URL("../src/app/useWorkoutPageDerivedState.js", import.meta.url)).replaceAll("\\", "/"));
const bundle = await rolldown({
  input: "workout-memo-runtime", platform: "browser", transform: { jsx: { runtime: "automatic" } },
  plugins: [{ name: "workout-memo-fixture", resolveId: id => id === "workout-memo-runtime" ? id : /\/firebase(?:\.js)?$/.test(id) ? "workout-memo-firebase" : null,
    load(id) {
      if (id === "workout-memo-firebase") return "export const app={};export const auth={currentUser:null};export const db={};";
      if (id !== "workout-memo-runtime") return null;
      return { moduleType: "jsx", code: `
        import React,{useState}from'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';
        import{useWorkoutPageDerivedState}from ${hookPath};
        window.historyTraversals=0;window.historyEntryReads=0;window.resultsVersions=0;window.renderCount=0;
        const entry=(id,version,weight,date)=>new Proxy({id,date,assignedProgramUpdatedAt:version,exercises:[{id:'bench',name:'Bench',sets:[{reps:8,weight}]}]}, {get(target,key){window.historyEntryReads++;return Reflect.get(target,key)}});
        const trackedHistory=rows=>new Proxy(rows,{get(target,key){if(key===Symbol.iterator)window.historyTraversals++;return Reflect.get(target,key)}});
        const initialHistory=trackedHistory([entry('a','v1',20,'2026-10-18'),entry('b','v2',40,'2026-10-17')]);
        const initialPlan={assignedProgramUpdatedAt:'v1',workouts:[{id:'day-a',name:'Day A',exercises:[{id:'bench',video:'a.mp4'}]},{id:'day-b',name:'Day B',assignedProgramUpdatedAt:'v3',exercises:[{id:'bench',video:'b.mp4'}]}]};
        let previousResults;
        function Scene(){
          const[plan,setPlan]=useState(initialPlan),[selectedWorkoutId,setSelected]=useState('day-a'),[history,setHistory]=useState(initialHistory),[timerTick,setTick]=useState(11000),[workoutFinishedAt,setFinished]=useState(null);
          const value=useWorkoutPageDerivedState({plan,selectedWorkoutId,history,workoutStartedAt:1000,workoutFinishedAt,timerTick});
          window.renderCount++;if(previousResults!==value.lastExerciseResults){window.resultsVersions++;previousResults=value.lastExerciseResults}
          window.tickMany=count=>{for(let i=0;i<count;i++)flushSync(()=>setTick(tick=>tick+1000))};
          window.changePlan=()=>flushSync(()=>setPlan({...initialPlan,assignedProgramUpdatedAt:'v2'}));
          window.changeSelected=()=>flushSync(()=>setSelected('day-b'));
          window.changeHistory=()=>flushSync(()=>setHistory(trackedHistory([...initialHistory,entry('c','v3',60,'2026-10-19')])));
          window.finish=()=>flushSync(()=>setFinished(60000));
          return <><output data-testid='duration'>{value.workoutDurationText}</output><output data-testid='workout'>{value.workout?.name}</output><output data-testid='last-results'>{JSON.stringify(value.lastExerciseResults)}</output></>;
        }
        createRoot(document.getElementById('root')).render(<Scene/>);` };
    }
  }]
});
const generated = await bundle.generate({ format: "iife" }); await bundle.close();

test("actual workout hook updates elapsed time without traversing history; plan/selection/history invalidate memo", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(); await page.setContent('<main id="root"></main>');
    await page.addScriptTag({ content: generated.output[0].code });
    await expect(page.getByTestId("duration")).toHaveText("10 сек");
    await expect(page.getByTestId("last-results")).toContainText("20 кг");
    const snapshot = () => page.evaluate(() => ({ traversals: window.historyTraversals, entryReads: window.historyEntryReads, versions: window.resultsVersions, renders: window.renderCount }));
    const initial = await snapshot(); assert.ok(initial.traversals > 0); assert.ok(initial.entryReads > 0);
    await page.evaluate(() => window.tickMany(120)); await expect(page.getByTestId("duration")).toHaveText("2 мин 10 сек");
    const afterTicks = await snapshot();
    assert.equal(afterTicks.renders, initial.renders + 120);
    assert.equal(afterTicks.traversals, initial.traversals); assert.equal(afterTicks.entryReads, initial.entryReads); assert.equal(afterTicks.versions, initial.versions);

    await page.evaluate(() => window.changePlan()); await expect(page.getByTestId("last-results")).toContainText("40 кг");
    const afterPlan = await snapshot(); assert.ok(afterPlan.traversals > afterTicks.traversals); assert.ok(afterPlan.entryReads > afterTicks.entryReads); assert.equal(afterPlan.versions, afterTicks.versions + 1);
    await page.evaluate(() => window.changeSelected()); await expect(page.getByTestId("workout")).toHaveText("Day B"); await expect(page.getByTestId("last-results")).toHaveText("{}");
    const afterSelection = await snapshot(); assert.ok(afterSelection.traversals > afterPlan.traversals); assert.ok(afterSelection.entryReads > afterPlan.entryReads); assert.equal(afterSelection.versions, afterPlan.versions + 1);
    await page.evaluate(() => window.changeHistory()); await expect(page.getByTestId("last-results")).toContainText("60 кг");
    const afterHistory = await snapshot(); assert.ok(afterHistory.traversals > afterSelection.traversals); assert.ok(afterHistory.entryReads > afterSelection.entryReads); assert.equal(afterHistory.versions, afterSelection.versions + 1);

    await page.evaluate(() => window.finish()); await expect(page.getByTestId("duration")).toHaveText("59 сек");
    await page.evaluate(() => window.tickMany(30)); await expect(page.getByTestId("duration")).toHaveText("59 сек");
    const finished = await snapshot(); assert.equal(finished.traversals, afterHistory.traversals); assert.equal(finished.entryReads, afterHistory.entryReads); assert.equal(finished.versions, afterHistory.versions);
  } finally { await browser.close(); }
});
