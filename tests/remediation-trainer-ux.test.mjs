import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { rolldown } from "rolldown";
import { transform } from "lightningcss";
import { chromium } from "@playwright/test";
import {
  DEFAULT_CABINET_EVENTS, readCabinetEvents, saveCabinetEvents,
  isCabinetEventEnabled, toggleTrainerScheduleDate, getTrainerHistoryCoverage
} from "../src/utils/trainerWorkspaceUx.js";
import { buildTrainerDailyJournal, getTrainerAttentionEventId } from "../src/utils/trainerDailyJournal.js";
import { createSingleDayWorkoutProgramBlocks } from "../src/utils/auditSafety.js";
import { TRAINER_PROGRAM_FORMATS, getTrainerProgramFormatMeta } from "../src/utils/trainerProgramFormat.js";
import { getWorkoutNoteItems } from "../src/utils/trainerClientMessages.js";

const require = createRequire(import.meta.url);
const workspace = await readFile("src/components/trainer/TrainerWorkspace.jsx", "utf8");
const notesPath = fileURLToPath(new URL("../src/utils/trainerClientMessages.js", import.meta.url)).replaceAll("\\", "/");
const messagesSource = workspace.slice(workspace.indexOf("function ClientMessages("), workspace.indexOf("function getTrainerWorkoutScheduleCalendar("));
const dateSource = workspace.slice(workspace.indexOf("function formatCompactDate("), workspace.indexOf("function formatSubscriptionDate("));

async function compileUi(code, browserWindow = { location: { pathname: "/trainer-v2" } }, browser = false) {
  const bundle = await rolldown({
    input: "trainer-ux-test-entry", platform: browser ? "browser" : "node", external: browser ? [] : ["react", "react/jsx-runtime"],
    transform: { jsx: { runtime: "automatic" } },
    plugins: [{ name: "trainer-ux-readonly-components", resolveId(id) {
      if (id === "trainer-ux-test-entry") return id;
    }, async load(id) {
      if (id === "trainer-ux-test-entry") return { code, moduleType: "jsx" };
      if (id.endsWith(".css")) return { code: "export default new Proxy({}, {get:(_,key)=>key});", moduleType: "js" };
    } }]
  });
  const result = await bundle.generate({ format: browser ? "iife" : "cjs" });
  await bundle.close();
  if (browser) return result.output[0].code;
  const module = { exports: {} };
  vm.runInNewContext(result.output[0].code, { module, exports: module.exports, require, window: browserWindow, console });
  return module.exports;
}
const { ClientMessages } = await compileUi(`
  import {useState,useRef} from 'react';
  import {getWorkoutNoteItems} from ${JSON.stringify(notesPath)};
  const trainerClientMessagesStyles=new Proxy({},{get:(_,key)=>key});
  const Check=()=>null, ChevronDown=()=>null, Mail=()=>null, MessageSquare=()=>null;
  ${dateSource} ${messagesSource}
  export {ClientMessages};
`);
const dashboardPath = new URL("../src/components/trainer/TrainerClientProgressDashboard.jsx", import.meta.url).pathname.replace(/^\//, "");
const { ProgressDashboard } = await compileUi(`export {default as ProgressDashboard} from ${JSON.stringify(dashboardPath.replaceAll("\\", "/"))};`);

test("Т01 cabinet preferences persist per UID and filter only their selected categories", () => {
  const data = new Map(); const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  assert.equal(saveCabinetEvents(storage, "trainer-a", { ...DEFAULT_CABINET_EVENTS, missedWorkout: false }), true);
  const settings = readCabinetEvents(storage, "trainer-a");
  assert.equal(isCabinetEventEnabled("workout", settings), false);
  assert.equal(isCabinetEventEnabled("nutrition", settings), true);
  assert.equal(isCabinetEventEnabled("program", settings), true);
  assert.equal(readCabinetEvents(storage, "trainer-b").missedWorkout, true);
  assert.equal(saveCabinetEvents(storage, "", settings), false);
  assert.equal(readCabinetEvents({ getItem: () => '{"missedWorkout":"false"}' }, "a").missedWorkout, true);
  assert.equal(saveCabinetEvents({ setItem: () => { throw Error("quota"); } }, "a", settings), false);
});

test("Т02 thirteenth pending note remains visible after twelve newer notes are processed", () => {
  const history = Array.from({length: 13}, (_, index) => ({ id: `h${index}`, date: `2026-10-${String(19-index).padStart(2,"0")}`, clientComment: `Комментарий ${index}` }));
  const messages = getWorkoutNoteItems(history);
  assert.equal(messages.length, 13);
  const html = renderToStaticMarkup(React.createElement(ClientMessages, { history, processedMessageIds: new Set(history.slice(0, 12).map(item => `${item.id}-comment`)) }));
  assert.match(html, /Комментарий 12/);
  assert.match(html, /К разбору:\s*1/);
  assert.doesNotMatch(html, /ждут ответа/i);
  assert.doesNotMatch(html, /Все сообщения обработаны/);
});

test("Т02 incomplete history never claims every message has been processed", () => {
  const html = renderToStaticMarkup(React.createElement(ClientMessages, { historyCoverage: "partial", onLoadMoreHistory() {} }));
  assert.match(html, /Загружена часть истории/);
  assert.match(html, /Загрузить более ранние комментарии/);
  assert.doesNotMatch(html, /Все сообщения обработаны/);
});

test("Т03 same-category new evidence has a new identity without a clock-only reset", () => {
  const item = { clientId: "client", summary: { assignedProgramId: "p", lastWorkoutAt: "2026-10-17" }, attention: { type: "workout", reason: "Пропуск" }, lastActivityTimestamp: 10 };
  assert.equal(getTrainerAttentionEventId(item, "workout"), getTrainerAttentionEventId(structuredClone(item), "workout"));
  const changed = { ...item, summary: { ...item.summary, lastWorkoutAt: "2026-10-18" } };
  assert.notEqual(getTrainerAttentionEventId(item, "workout"), getTrainerAttentionEventId(changed, "workout"));
  const build = value => buildTrainerDailyJournal({ priorityItems: [value] }, Date.parse("2026-10-19T10:00:00Z")).items.find(event => event.requiresAction);
  assert.notEqual(build(item).id, build(changed).id);
  assert.equal(build(item).requiresAction, true);
});

test("Т03 a viewed unresolved signal remains in the actual journal action section", async () => {
  const item = { clientId: "c", client: {id: "c", name: "Клиент"}, summary: { assignedProgramId: "p" }, attention: { type: "workout", reason: "Пропуск" } };
  const reviewed = getTrainerAttentionEventId(item, "workout");
  const path = new URL("../src/components/trainer/TrainerDailyJournal.jsx", import.meta.url).pathname.replace(/^\//, "");
  const { Journal } = await compileUi(`export {default as Journal} from ${JSON.stringify(path)};`, { localStorage: { getItem: () => JSON.stringify([reviewed]) } });
  const html = renderToStaticMarkup(React.createElement(Journal, { actionCenter: { priorityItems: [item] }, trainerUid: "trainer", renderAvatar: () => null }));
  assert.match(html, /Нужно проверить/);
  assert.match(html, /Пропущена тренировка/);
});

test("Т04 historical schedule is immutable while future draft choices remain reversible", () => {
  const dates = ["2026-10-18", "2026-10-20"];
  assert.deepEqual(toggleTrainerScheduleDate(dates, "2026-10-18", "2026-10-19", 2), dates);
  const removed = toggleTrainerScheduleDate(dates, "2026-10-20", "2026-10-19", 2);
  assert.deepEqual(removed, ["2026-10-18"]);
  assert.deepEqual(toggleTrainerScheduleDate(removed, "2026-10-20", "2026-10-19", 2), dates);
  assert.deepEqual(toggleTrainerScheduleDate(dates, "2026-10-21", "2026-10-19", 2), dates);
});

test("Т05 actual progress component labels partial and failed history, not a complete six-month analysis", () => {
  assert.equal(getTrainerHistoryCoverage({ trainerHistoryLoadError: true, trainerHistoryHasMore: true }), "error");
  assert.equal(getTrainerHistoryCoverage({ trainerHistoryHasMore: true }), "partial");
  const html = renderToStaticMarkup(React.createElement(ProgressDashboard, { historyCoverage: "partial", onLoadMoreHistory() {} }));
  assert.match(html, /Аналитика силы может охватывать не весь выбранный период/);
  assert.match(html, /Загрузить следующую страницу истории/);
  const failed = renderToStaticMarkup(React.createElement(ProgressDashboard, { historyCoverage: "error" }));
  assert.match(failed, /История тренировок не загрузилась/);
});

test("Т08 actual chart provides exact dated values and units with a keyboard-readable table", () => {
  const html = renderToStaticMarkup(React.createElement(ProgressDashboard, { measurements: [
    { date: new Date().toISOString(), weight: 80 },
    { date: new Date(Date.now()-86400000).toISOString(), weight: 81 }
  ] }));
  assert.match(html, /Даты и точные значения/);
  assert.match(html, /Значение, кг/);
  assert.match(html, /80,0/);
  assert.match(html, /81,0/);
  assert.match(html, /tabindex="0"/);
});

test("Т09–Т11 changed CSS parses without dropping rules", async () => {
  for (const path of ["src/components/trainer/TrainerClientMessages.module.css", "src/components/trainer/TrainerClientProgressDashboard.module.css", "src/components/trainer/TrainerWorkspaceSubscriptionProgress.module.css", "src/features/trainer/TrainerProgramOverviewPage.module.css"]) {
    const result = transform({ filename: path, code: await readFile(path), cssModules: true, errorRecovery: false });
    assert.ok(result.code.length);
  }
});

test("Т09 actual message filters reflow without overlapping labels or counters at 320/402", {timeout:30000}, async () => {
  const sheet = transform({filename:"messages.module.css",code:await readFile("src/components/trainer/TrainerClientMessages.module.css"),cssModules:true});
  const names = Object.fromEntries(Object.entries(sheet.exports).map(([key,value])=>[key,value.name]));
  const code = await compileUi(`import React,{useState,useRef} from 'react';import{createRoot}from'react-dom/client';
    import {getWorkoutNoteItems} from ${JSON.stringify(notesPath)};
    const trainerClientMessagesStyles=${JSON.stringify(names)};
    const Check=()=>null,ChevronDown=()=>null,Mail=()=>null,MessageSquare=()=>null;
    ${dateSource}${messagesSource}
    const history=Array.from({length:101},(_,i)=>({id:'h'+i,date:'2026-10-19',clientComment:'Сообщение'}));
    createRoot(document.getElementById('root')).render(<ClientMessages history={history}/>);`, undefined, true);
  const browser = await chromium.launch();
  try {
    for(const width of [320,402]) {
      const page=await browser.newPage({viewport:{width,height:874}});
      await page.setContent('<div id="root"></div>');
      await page.addStyleTag({content:`*{box-sizing:border-box}body{margin:0;padding:12px;font-family:Arial} ${sheet.code.toString()}`});
      await page.addScriptTag({content:code});
      await page.locator(`.${names.filters} button`).first().waitFor();
      const readable=await page.locator(`.${names.filters}`).evaluate(nav=>{
        const buttons=[...nav.querySelectorAll('button')];
        return buttons.every((button,index)=>{
          const rect=button.getBoundingClientRect();const count=[...button.querySelectorAll('span')].at(-1).getBoundingClientRect();
          return button.scrollWidth<=button.clientWidth && count.left>=rect.left && count.right<=rect.right &&
            buttons.slice(0,index).every(previous=>{const before=previous.getBoundingClientRect();
              return before.right<=rect.left || rect.right<=before.left || before.bottom<=rect.top || rect.bottom<=before.top;});
        });
      });
      assert.equal(readable,true,`filters overlap at ${width}`);
      await page.close();
    }
  } finally {await browser.close();}
});

test("Т12 every organizational label creates the same empty one-day structure and truthful metadata", async () => {
  const source = await readFile("src/features/trainer/trainerMonthProgramPersistenceHandlers.js", "utf8");
  const body = source.slice(source.indexOf("  function createNewMonthProgramDraft("), source.indexOf("  async function duplicateMonthProgramFromLibrary("));
  let draft;
  const noop = () => {};
  const create = vm.runInNewContext(`${body};createNewMonthProgramDraft`, {
    getCurrentProgramOwner: () => ({uid:"trainer", role:"trainer"}),
    getTrainerProgramFormatMeta, createSingleDayWorkoutProgramBlocks,
    normalizeMonthProgram: value => value, flattenMonthProgramWorkouts: value => value.blocks.flatMap(b => b.weeks.flatMap(w => w.workouts)),
    setAdminProgramEditorMode:noop,setAdminProgramLibraryTab:noop,setAdminOpenWorkoutId:noop,setAdminOpenProgramBlocks:noop,
    setAdminOpenProgramWeeks:noop,setAdminActiveProgramId:noop,setAdminSelectedTemplateId:noop,setPlan:noop,
    setAdminProgramGroups: value => { draft=value[0]; }
  });
  for (const format of TRAINER_PROGRAM_FORMATS) {
    create(format.id);
    assert.equal(draft.trainingFormat, format.id);
    assert.match(draft.description, /Дни и упражнения заполняются тренером/);
    assert.equal(draft.blocks.flatMap(b=>b.weeks.flatMap(w=>w.workouts)).length, 1);
    assert.equal(draft.blocks[0].weeks[0].workouts[0].exercises.length, 0);
  }
});
