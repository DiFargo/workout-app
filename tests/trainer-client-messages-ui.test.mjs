import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { chromium, expect } from "@playwright/test";
import { getWorkoutNoteItems } from "../src/utils/trainerClientMessages.js";

const workspace = await readFile(new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url), "utf8");
const start = workspace.indexOf("function ClientMessages(");
const end = workspace.indexOf("function getTrainerWorkoutScheduleCalendar(", start);
assert.ok(start >= 0 && end > start, "ClientMessages должен оставаться настоящим компонентом из TrainerWorkspace");
const messagesSource = workspace.slice(start, end);
const attentionStart = workspace.indexOf("function ClientOverviewAttention(");
const attentionEnd = workspace.indexOf("function TrainerClientDetail(", attentionStart);
assert.ok(attentionStart >= 0 && attentionEnd > attentionStart, "ClientOverviewAttention должен проверяться из настоящего TrainerWorkspace");
const attentionSource = workspace.slice(attentionStart, attentionEnd);
const dateSource = workspace.slice(workspace.indexOf("function formatCompactDate("), workspace.indexOf("function formatSubscriptionDate("));
const helperPath = fileURLToPath(new URL("../src/utils/trainerClientMessages.js", import.meta.url)).replaceAll("\\", "/");
const variantPath = fileURLToPath(new URL("../src/app/cssVariant.js", import.meta.url)).replaceAll("\\", "/");
const subscriptionPath = fileURLToPath(new URL("../src/utils/clientSubscription.js", import.meta.url)).replaceAll("\\", "/");
const history = [
  { id: "new-session", workoutId: "legs", workoutName: "Ноги — тренировка А", finishedAt: "2026-10-30T10:00:00Z",
    clientComment: "После тренировки было непривычное напряжение.", postWorkoutFeedback: { title: "Было тяжело", advice: "Системный совет не является сообщением клиента" } },
  { id: "exercise-session", workoutId: "upper", workoutName: "Верх — тренировка Б", finishedAt: "2026-10-29T10:00:00Z",
    exercises: [{ id: "row", name: "Тяга блока", clientNote: `Левое плечо устало. ${"Подробности клиента. ".repeat(20)}` }] },
  { id: "processed-session", workoutId: "basic", workoutName: "Базовая тренировка", finishedAt: "2026-10-28T10:00:00Z", clientComment: "Спасибо, всё понятно." },
  { id: "system-only", workoutName: "Без комментариев", date: "2026-10-31", postWorkoutFeedback: { title: "Отлично", advice: "Автоматическая рекомендация должна остаться в истории" } }
];
const noteItems = getWorkoutNoteItems(history);
const pendingIds = ["new-session-comment", "exercise-session-exercise-row"];
const bundle = await rolldown({ input: "trainer-client-messages-ui-fixture", platform: "browser",
  transform: { jsx: { runtime: "automatic" } }, plugins: [{ name: "trainer-client-messages-react-only",
    resolveId(id) { return id === "trainer-client-messages-ui-fixture" ? id : null; },
    load(id) {
      if (id.endsWith(".css")) return { code: "export default {};", moduleType: "js" };
      if (id !== "trainer-client-messages-ui-fixture") return null;
      return { moduleType: "jsx", code: `
        import React,{useState,useRef}from'react';import{createRoot}from'react-dom/client';
        import{getWorkoutNoteItems}from ${JSON.stringify(helperPath)};
        import{isTrainerV2Path}from ${JSON.stringify(variantPath)};
        import{getSubscriptionAttentionLabel,getSubscriptionStatus}from ${JSON.stringify(subscriptionPath)};
        const trainerClientMessagesStyles=new Proxy({},{get:(_,key)=>key});
        const clientOverviewStyles=new Proxy({},{get:(_,key)=>key});
        const Check=()=>null,ChevronDown=()=>null,Mail=()=>null,MessageSquare=()=>null,CircleAlert=()=>null,ChevronRight=()=>null;
        ${dateSource}${messagesSource}${attentionSource}
        const history=${JSON.stringify(history)};
        window.messageCalls=[];window.messageFailure='';window.messageHold=false;window.messageRelease=null;
        let latestProcessed;
        function Scene(){const[processed,setProcessed]=useState(new Set(['processed-session-comment'])),[attention,setAttention]=useState(null);latestProcessed=processed;
          const mark=async items=>{
            window.messageCalls.push({type:'mark',items});
            if(window.messageHold)await new Promise(resolve=>window.messageRelease=resolve);
            if(window.messageFailure==='false')return false;
            if(window.messageFailure==='throw')throw new Error('synthetic marking failure');
            if(window.messageFailure==='undefined')return undefined;
            setProcessed(current=>new Set([...current,...items.map(item=>item.id)]));return true;
          };
          window.messagesScene={processed:()=>[...latestProcessed],hold:()=>window.messageHold=true,
            release:()=>{window.messageHold=false;window.messageRelease?.();},fail:mode=>window.messageFailure=mode,
            showAttention:(items,review)=>setAttention({history:items,review})};
          if(attention)return <ClientOverviewAttention client={{id:'synthetic-client'}}
            snapshot={{criticalAttentionItems:[{type:'feedback',reason:'Нужен разбор самочувствия'}]}}
            workoutReview={attention.review} history={attention.history}
            onOpenWorkoutHistory={()=>window.messageCalls.push({type:'workout-history'})}
            onOpenFeedback={item=>window.messageCalls.push({type:'feedback',item})}
            onTabChange={tab=>window.messageCalls.push({type:'tab',tab})}/>;
          return <ClientMessages history={history} processedMessageIds={processed} onMarkAllProcessed={mark}
            onReplyToMessage={item=>window.messageCalls.push({type:'reply',item})}/>;
        }
        createRoot(document.getElementById('root')).render(<Scene/>);
      ` };
    }
  }] });
const generated = await bundle.generate({ format: "iife", codeSplitting: false });
await bundle.close();
const code = generated.output.find(item => item.type === "chunk").code;
const filter = (page, name) => page.getByRole("navigation", { name: "Фильтры сообщений клиента" }).getByRole("button", { name: new RegExp(`^${name}\\s*\\d+$`) });
const row = (page, text) => page.getByTestId("trainer-client-message-item").filter({ hasText: text });
const markCalls = page => page.evaluate(() => window.messageCalls.filter(call => call.type === "mark"));
const replyCalls = page => page.evaluate(() => window.messageCalls.filter(call => call.type === "reply"));

async function fixture(run) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => route.abort());
    await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><main id="root"></main>');
    await page.addScriptTag({ content: code });
    await expect(page.getByRole("heading", { name: "Комментарии клиента" })).toBeVisible();
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

test("сообщения тренера: фильтры и конкретный источник отражают только клиентский текст, без system advice и автообработки", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await expect(filter(page, "Требуют внимания")).toHaveAttribute("aria-pressed", "true");
    await expect(filter(page, "Требуют внимания")).toHaveText(/Требуют внимания\s*2/);
    await expect(filter(page, "Обработанные")).toHaveText(/Обработанные\s*1/);
    await expect(filter(page, "Все")).toHaveText(/Все\s*3/);
    await expect(page.getByText("К разбору: 2", { exact: true })).toBeVisible();
    const comment = row(page, "После тренировки было непривычное напряжение.");
    await expect(comment.getByText("Комментарий к тренировке", { exact: true })).toBeVisible();
    await expect(comment.getByText("Ноги — тренировка А", { exact: true })).toBeVisible();
    const exercise = row(page, "Левое плечо устало.");
    await expect(exercise.getByText("Тяга блока", { exact: true })).toBeVisible();
    await expect(exercise.getByText("Заметка к упражнению · Верх — тренировка Б", { exact: true })).toBeVisible();
    await exercise.locator("details summary").click();
    await expect(exercise.locator("details")).toHaveAttribute("open", "");
    await filter(page, "Обработанные").click();
    await expect(row(page, "Спасибо, всё понятно.")).toBeVisible();
    await expect(comment).toHaveCount(0);
    await filter(page, "Все").click();
    await expect(page.getByTestId("trainer-client-message-item")).toHaveCount(3);
    assert.equal(await page.locator("body").textContent().then(text => /ждут ответа|Системный совет|Автоматическая рекомендация/.test(text)), false);
    assert.deepEqual(await markCalls(page), []);
    assert.deepEqual(await replyCalls(page), []);
  });
});

test("сообщения тренера: Ответить сохраняет полный context и само по себе не отмечает запись обработанной", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await row(page, "После тренировки было непривычное напряжение.").getByRole("button", { name: "Ответить", exact: true }).click();
    assert.deepEqual(await replyCalls(page), [{ type: "reply", item: noteItems.find(item => item.id === pendingIds[0]) }]);
    assert.deepEqual(await markCalls(page), []);
    assert.deepEqual(await page.evaluate(() => window.messagesScene.processed()), ["processed-session-comment"]);
    await expect(page.getByText("К разбору: 2", { exact: true })).toBeVisible();
  });
});

test("сообщения тренера: одиночная обработка передаёт только выбранную запись, не отправляя ответ", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await row(page, "После тренировки было непривычное напряжение.").getByRole("button", { name: "Отметить обработанным", exact: true }).click();
    await expect(row(page, "После тренировки было непривычное напряжение.")).toHaveCount(0);
    assert.deepEqual(await markCalls(page), [{ type: "mark", items: [noteItems.find(item => item.id === pendingIds[0])] }]);
    assert.deepEqual(await replyCalls(page), []);
    await expect(page.getByText("К разбору: 1", { exact: true })).toBeVisible();
    await filter(page, "Обработанные").click();
    await expect(row(page, "После тренировки было непривычное напряжение.")).toBeVisible();
  });
});

test("сообщения тренера: массовая обработка требует inline confirm, Отмена ничего не отправляет, подтверждение исключает уже обработанные", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await page.getByRole("button", { name: "Обработать все", exact: true }).click();
    const confirmation = page.getByRole("group", { name: "Подтверждение обработки сообщений" });
    await expect(confirmation).toBeVisible();
    await expect(confirmation.getByText("Ответ клиенту не отправится.", { exact: false })).toBeVisible();
    assert.deepEqual(await markCalls(page), []);
    await confirmation.getByRole("button", { name: "Отмена", exact: true }).click();
    await expect(confirmation).toHaveCount(0);
    assert.deepEqual(await markCalls(page), []);
    await page.getByRole("button", { name: "Обработать все", exact: true }).click();
    await confirmation.getByRole("button", { name: "Отметить все обработанными", exact: true }).click();
    await expect(confirmation).toHaveCount(0);
    assert.deepEqual((await markCalls(page)).map(call => call.items.map(item => item.id)), [pendingIds]);
    assert.deepEqual(await replyCalls(page), []);
    await filter(page, "Обработанные").click();
    await expect(page.getByTestId("trainer-client-message-item")).toHaveCount(3);
  });
});

test("сообщения тренера: pending блокирует все reply/processing действия и ref guard не дублирует запрос", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await page.evaluate(() => window.messagesScene.hold());
    const selected = row(page, "После тренировки было непривычное напряжение.");
    const toggle = selected.getByRole("button", { name: "Отметить обработанным", exact: true });
    await toggle.evaluate(button => { button.click(); button.click(); });
    await expect(selected.getByRole("button", { name: "Сохраняем…", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Обработать все", exact: true })).toBeDisabled();
    for (const button of await page.getByRole("button", { name: "Ответить", exact: true }).all()) await expect(button).toBeDisabled();
    await expect(row(page, "Левое плечо устало.").getByRole("button", { name: "Отметить обработанным", exact: true })).toBeDisabled();
    assert.equal((await markCalls(page)).length, 1);
    await page.evaluate(() => window.messagesScene.release());
    await expect(selected).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Обработать все", exact: true })).toBeEnabled();
    assert.deepEqual(await replyCalls(page), []);
  });
});

test("сообщения тренера: false/throw оставляют комментарий к разбору, показывают alert и освобождают lock", { timeout: 30000 }, async () => {
  await fixture(async page => {
    for (const mode of ["false", "throw"]) {
      await page.evaluate(mode => window.messagesScene.fail(mode), mode);
      const selected = row(page, "После тренировки было непривычное напряжение.");
      await selected.getByRole("button", { name: "Отметить обработанным", exact: true }).click();
      await expect(page.getByRole("alert")).toHaveText("Не удалось отметить сообщения. Попробуйте ещё раз.");
      await expect(selected).toBeVisible();
      await expect(selected.getByRole("button", { name: "Отметить обработанным", exact: true })).toBeEnabled();
      await expect(page.getByText("К разбору: 2", { exact: true })).toBeVisible();
      assert.deepEqual(await page.evaluate(() => window.messagesScene.processed()), ["processed-session-comment"]);
    }
    assert.equal((await markCalls(page)).length, 2);
    assert.deepEqual(await replyCalls(page), []);
  });
});

test("сообщения тренера: resolve undefined не выдаётся за подтверждение обработки или новую отметку", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await page.evaluate(() => window.messagesScene.fail("undefined"));
    const selected = row(page, "После тренировки было непривычное напряжение.");
    await selected.getByRole("button", { name: "Отметить обработанным", exact: true }).click();
    await expect(selected).toBeVisible();
    await expect(selected.getByRole("button", { name: "Отметить обработанным", exact: true })).toBeEnabled();
    await expect(page.getByText("К разбору: 2", { exact: true })).toBeVisible();
    assert.deepEqual(await page.evaluate(() => window.messagesScene.processed()), ["processed-session-comment"]);
    assert.deepEqual(await replyCalls(page), []);
  });
});

test("сигнал оценки: новая оценка без своего комментария открывает историю, а не чужой старый комментарий или сообщения", { timeout: 30000 }, async () => {
  await fixture(async page => {
    const reviewHistory = [
      { id: "old-comment", date: "2026-10-01", clientComment: "Старый комментарий относится к другой тренировке." },
      { id: "new-rating", date: "2026-10-30", postWorkoutFeedback: { title: "Было тяжело", advice: "Системная рекомендация, не клиентский комментарий" } }
    ];
    await page.evaluate(history => window.messagesScene.showAttention(history, { historyId: "new-rating" }), reviewHistory);
    await expect(page.getByRole("button", { name: "Открыть комментарий", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Посмотреть оценку", exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.messageCalls), [{ type: "workout-history" }]);
  });
});

test("сигнал оценки: точный historyId открывает только совпавший клиентский комментарий, не старую или более новую чужую заметку", { timeout: 30000 }, async () => {
  await fixture(async page => {
    const reviewHistory = [
      { id: "old-comment", date: "2026-10-01", clientComment: "Старый чужой комментарий." },
      { id: "matched-review", workoutId: "target-day", workoutName: "Точная тренировка", date: "2026-10-29", clientComment: "Комментарий именно к проверяемой оценке." },
      { id: "unrelated-newer", date: "2026-10-30", clientComment: "Более свежая заметка, но другой historyId." }
    ];
    await page.evaluate(history => window.messagesScene.showAttention(history, { historyId: "matched-review" }), reviewHistory);
    await expect(page.getByRole("button", { name: "Посмотреть оценку", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Открыть комментарий", exact: true }).click();
    const matchedNote = getWorkoutNoteItems(reviewHistory).find(note => note.historyId === "matched-review");
    assert.deepEqual(await page.evaluate(() => window.messageCalls), [{ type: "feedback", item: matchedNote }]);
  });
});
