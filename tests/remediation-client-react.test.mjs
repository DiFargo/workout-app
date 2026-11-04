import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { chromium, expect } from "@playwright/test";

const path = name => JSON.stringify(fileURLToPath(new URL(`../src/${name}`, import.meta.url)).replaceAll("\\", "/"));
const bundle = await rolldown({
  input: "remediation-client-react", platform: "browser", transform: { jsx: { runtime: "automatic" } },
  plugins: [{ name: "client-runtime-fixture", resolveId: id => id === "remediation-client-react" ? id : /\/firebase(?:\.js)?$/.test(id) ? "client-fixture-firebase" : null,
    load(id) {
      if (id === "client-fixture-firebase") return "export const auth={currentUser:null}; export const db={}; export const storage={}; export const functions={};";
      if (id.endsWith(".css")) return { code: "export default {};", moduleType: "js" };
      if (id !== "remediation-client-react") return null;
      return { moduleType: "jsx", code: `
        import React, {useState} from 'react'; import {createRoot} from 'react-dom/client';
        import {useWallClockCountdown} from ${path("features/client/workouts/useWorkoutRuntimeEffects.js")};
        import Actions from ${path("features/client/nutrition/FoodProductTopActions.jsx")};
        import Confirm from ${path("features/client/nutrition/NutritionDeleteConfirmModal.jsx")};
        function Timer({seconds,running,setSeconds,setRunning}) {useWallClockCountdown({seconds,running,setSeconds,setRunning,completionVibration:'rest'});return null;}
        function Scene(){
          const [seconds,setSeconds]=useState(90),[running,setRunning]=useState(true),[mounted,setMounted]=useState(true),[confirm,setConfirm]=useState(false),[exists,setExists]=useState(true);
          window.setDuration=setSeconds;window.pauseTimer=()=>setRunning(false);window.resumeTimer=()=>setRunning(true);window.mountTimer=setMounted;
          window.resetTimer=()=>{setSeconds(0);setRunning(false)};
          return <><output data-testid='seconds'>{seconds}</output><output data-testid='running'>{String(running)}</output>
            {mounted&&<Timer {...{seconds,running,setSeconds,setRunning}}/>}
            {exists&&<Actions onClose={()=>{}} onDelete={()=>setConfirm(true)}/>}
            <Confirm open={confirm} foodName='Личный продукт' onCancel={()=>setConfirm(false)} onConfirm={()=>{window.deleted=true;setExists(false);setConfirm(false)}}/>
          </>;
        }
        createRoot(document.getElementById('root')).render(<Scene/>);` };
    }
  }]
});
const generated = await bundle.generate({ format: "iife" });
await bundle.close();

test("real React countdown updates running duration, pauses/resumes and catches up elapsed background time", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.clock.install({ time: new Date("2026-10-18T12:00:00Z") });
    await page.setContent('<main id="root"></main>');
    await page.addScriptTag({ content: generated.output[0].code });
    const seconds = page.getByTestId("seconds");
    await expect(seconds).toHaveText("90");
    await page.clock.fastForward(10000); await expect(seconds).toHaveText("80");
    await page.evaluate(() => window.pauseTimer()); await expect(page.getByTestId("running")).toHaveText("false");
    await page.clock.fastForward(20000); await expect(seconds).toHaveText("80");
    await page.evaluate(() => window.resumeTimer()); await expect(page.getByTestId("running")).toHaveText("true");
    await page.clock.fastForward(10000); await expect(seconds).toHaveText("70");
    await page.evaluate(() => window.setDuration(120)); await expect(seconds).toHaveText("120");
    await page.clock.fastForward(5000); await expect(seconds).toHaveText("115");
    // Fast-forward invokes delayed callbacks once, modelling a throttled tab
    // instead of assuming 100 interval callbacks were delivered in background.
    await page.clock.fastForward(100000);
    await page.evaluate(() => window.dispatchEvent(new Event("focus"))); await expect(seconds).toHaveText("15");
    await page.evaluate(() => window.mountTimer(false));
    await page.evaluate(() => window.mountTimer(true));
    await page.clock.fastForward(15000); await expect(seconds).toHaveText("0");
    await expect(page.getByTestId("running")).toHaveText("false");
    await page.evaluate(() => { window.setDuration(90); window.resumeTimer(); });
    await page.clock.fastForward(1000); await expect(seconds).toHaveText("89");
    await page.evaluate(() => window.resetTimer());
    await expect(seconds).toHaveText("0");
    await page.clock.fastForward(10000); await expect(seconds).toHaveText("0");
    await expect(page.getByTestId("running")).toHaveText("false");
  } finally { await browser.close(); }
});

test("actual library delete controls provide cancel and explicit confirmation", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(); await page.setContent('<main id="root"></main>');
    await page.addScriptTag({ content: generated.output[0].code });
    const remove = page.getByRole("button", { name: "Удалить из моей базы", exact: true });
    await remove.click(); await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Записи в дневнике останутся без изменений.", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Отмена", exact: true }).click(); await expect(page.getByRole("dialog")).toHaveCount(0);
    assert.equal(await page.evaluate(() => Boolean(window.deleted)), false);
    await remove.click(); await page.getByRole("button", { name: "Удалить", exact: true }).click();
    assert.equal(await page.evaluate(() => window.deleted), true); await expect(remove).toHaveCount(0);
  } finally { await browser.close(); }
});
