import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { chromium, expect } from "@playwright/test";

const source = name => JSON.stringify(fileURLToPath(new URL(`../src/${name}`, import.meta.url)).replaceAll("\\", "/"));
const bundle = await rolldown({ input: "notifications-modal-fixture", platform: "browser",
  transform: { jsx: { runtime: "automatic" } }, plugins: [{ name: "notifications-modal-react-fixture",
    resolveId(id) { return id === "notifications-modal-fixture" ? id : null; },
    load(id) {
      if (id.endsWith(".css")) return { code: "export default {};", moduleType: "js" };
      if (id !== "notifications-modal-fixture") return null;
      return { moduleType: "jsx", code: `
        import React,{useState}from'react';import{createRoot}from'react-dom/client';
        import Modal from ${source("features/client/profile/ProfileTrainerNotificationsModal.jsx")};
        import{getTrainerTaskStatus}from ${source("domain/clientInsights.js")};
        const initial=[
          {id:'active-task',title:'Проверить дневник питания',status:'progress',destination:'nutrition',dueDate:'2026-01-01'},
          {id:'unread-message',notificationType:'message',title:'Новое сообщение',status:'progress',message:'Актуальное сообщение: проверьте технику упражнения.'},
          {id:'completed-task',title:'Добавить замеры тела',status:'completed',destination:'measurements'},
          {id:'read-message',notificationType:'message',title:'Прочитанное сообщение',status:'progress',completedAt:'2026-10-30T09:00:00Z',message:'Ранее прочитанное сообщение: результаты получены.'}
        ];
        let latest;window.notificationCalls=[];window.notificationPending={};window.notificationHeld=new Set();window.notificationFail=new Set();window.notificationThrow=new Set();
        function Scene(){const[open,setOpen]=useState(false),[tasks,setTasks]=useState(initial);latest=tasks;
          const update=async(task,completed)=>{
            window.notificationCalls.push({type:'update',id:task.id,completed});
            if(window.notificationHeld.has(task.id))await new Promise(resolve=>window.notificationPending[task.id]=resolve);
            if(window.notificationThrow.has(task.id))throw new Error('synthetic callback failure');
            if(window.notificationFail.has(task.id))return false;
            setTasks(current=>current.map(item=>item.id===task.id?{...item,status:completed?'completed':'progress',completedAt:completed?'2026-10-30T12:00:00Z':''}:item));
            return true;
          };
          window.notificationsScene={snapshot:()=>latest,close:()=>setOpen(false),open:()=>setOpen(true),
            hold:id=>window.notificationHeld.add(id),release:id=>{window.notificationHeld.delete(id);window.notificationPending[id]?.();},
            fail:id=>window.notificationFail.add(id),reject:id=>window.notificationThrow.add(id),
            retry:id=>{window.notificationFail.delete(id);window.notificationThrow.delete(id)}};
          return <><button onClick={()=>setOpen(true)}>Открыть тестовые уведомления</button><Modal open={open} tasks={tasks}
            activeCount={tasks.filter(task=>getTrainerTaskStatus(task).id!=='completed').length}
            getTaskDestination={task=>task.destination||''} onClose={()=>{window.notificationCalls.push({type:'close'});setOpen(false)}}
            onOpenTask={(task,destination)=>window.notificationCalls.push({type:'open',id:task.id,destination})}
            onUpdateTask={update}/></>;
        }
        createRoot(document.getElementById('root')).render(<Scene/>);
      ` };
    }
  }] });
const generated = await bundle.generate({ format: "iife", codeSplitting: false });
await bundle.close();
const code = generated.output.find(item => item.type === "chunk").code;
const activeTab = page => page.getByRole("tab", { name: /^Актуальные\s*\d+$/ });
const historyTab = page => page.getByRole("tab", { name: /^История\s*\d+$/ });
const item = (page, text) => page.getByTestId("profile-trainer-notification-item").filter({ hasText: text });
const calls = page => page.evaluate(() => window.notificationCalls);
const updates = page => page.evaluate(() => window.notificationCalls.filter(call => call.type === "update"));
const snapshot = page => page.evaluate(() => window.notificationsScene.snapshot());

async function fixture(run) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => route.abort());
    await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><main id="root"></main>');
    await page.addScriptTag({ content: code });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Открыть тестовые уведомления" }).click();
    await expect(page.getByRole("dialog", { name: "Уведомления" })).toBeVisible();
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

test("уведомления: реальные вкладки отделяют активные задачи/непрочитанные сообщения от completed/read по общему статусу", { timeout: 30000 }, async () => {
  await fixture(async page => {
    const initial = await snapshot(page);
    await expect(activeTab(page)).toHaveText(/Актуальные\s*2/);
    await expect(activeTab(page)).toHaveAttribute("aria-selected", "true");
    await expect(historyTab(page)).toHaveText(/История\s*2/);
    await expect(page.getByRole("tabpanel")).toHaveCount(1);
    await expect(item(page, "Проверить дневник питания")).toBeVisible();
    await expect(item(page, "Актуальное сообщение:")).toBeVisible();
    await expect(item(page, "Добавить замеры тела")).toHaveCount(0);
    await expect(item(page, "Ранее прочитанное сообщение:")).toHaveCount(0);
    await historyTab(page).click();
    await expect(historyTab(page)).toHaveAttribute("aria-selected", "true");
    await expect(item(page, "Добавить замеры тела")).toBeVisible();
    await expect(item(page, "Ранее прочитанное сообщение:")).toBeVisible();
    await expect(item(page, "Проверить дневник питания")).toHaveCount(0);
    assert.deepEqual(await snapshot(page), initial);
    assert.deepEqual(await updates(page), []);
  });
});

test("уведомления: открытие задачи и чтение полного сообщения не изменяют статус без явного действия", { timeout: 30000 }, async () => {
  await fixture(async page => {
    const initial = await snapshot(page);
    await item(page, "Проверить дневник питания").getByRole("button", { name: "Открыть", exact: true }).click();
    assert.deepEqual(await calls(page), [{ type: "open", id: "active-task", destination: "nutrition" }]);
    const details = item(page, "Актуальное сообщение:").locator("details");
    await details.locator("summary").click();
    await expect(details).toHaveAttribute("open", "");
    await details.locator("summary").click();
    await expect(details).not.toHaveAttribute("open", "");
    await historyTab(page).click();
    await item(page, "Добавить замеры тела").getByRole("button", { name: "Открыть", exact: true }).click();
    assert.deepEqual(await calls(page), [
      { type: "open", id: "active-task", destination: "nutrition" },
      { type: "open", id: "completed-task", destination: "measurements" }
    ]);
    assert.deepEqual(await updates(page), []);
    assert.deepEqual(await snapshot(page), initial);
  });
});

test("уведомления: четыре точные подписи отправляют нужный callback boolean только после нажатия", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await item(page, "Проверить дневник питания").getByRole("button", { name: "Отметить выполненным", exact: true }).click();
    await expect(activeTab(page)).toHaveText(/Актуальные\s*1/);
    await historyTab(page).click();
    await item(page, "Добавить замеры тела").getByRole("button", { name: "Вернуть в актуальные", exact: true }).click();
    await item(page, "Ранее прочитанное сообщение:").getByRole("button", { name: "Отметить непрочитанным", exact: true }).click();
    await activeTab(page).click();
    await item(page, "Актуальное сообщение:").getByRole("button", { name: "Отметить прочитанным", exact: true }).click();
    assert.deepEqual(await updates(page), [
      { type: "update", id: "active-task", completed: true },
      { type: "update", id: "completed-task", completed: false },
      { type: "update", id: "read-message", completed: false },
      { type: "update", id: "unread-message", completed: true }
    ]);
    await expect(activeTab(page)).toHaveText(/Актуальные\s*2/);
    await expect(historyTab(page)).toHaveText(/История\s*2/);
  });
});

test("уведомления: pending изолирован по ID, повторное нажатие не дублирует запрос и не блокирует другую запись", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await page.evaluate(() => window.notificationsScene.hold("active-task"));
    const taskToggle = item(page, "Проверить дневник питания").getByTestId("profile-trainer-notification-toggle");
    await taskToggle.evaluate(button => { button.click(); button.click(); });
    await expect(taskToggle).toBeDisabled();
    assert.equal((await updates(page)).filter(call => call.id === "active-task").length, 1);
    const messageToggle = item(page, "Актуальное сообщение:").getByRole("button", { name: "Отметить прочитанным", exact: true });
    await expect(messageToggle).toBeEnabled();
    await messageToggle.click();
    await expect(item(page, "Актуальное сообщение:")).toHaveCount(0);
    await expect(taskToggle).toBeDisabled();
    await page.evaluate(() => window.notificationsScene.release("active-task"));
    await expect(item(page, "Проверить дневник питания")).toHaveCount(0);
    await historyTab(page).click();
    await expect(item(page, "Проверить дневник питания").getByRole("button", { name: "Вернуть в актуальные", exact: true })).toBeEnabled();
    assert.deepEqual(await updates(page), [
      { type: "update", id: "active-task", completed: true },
      { type: "update", id: "unread-message", completed: true }
    ]);
  });
});

test("уведомления: клавиатурное переключение вкладок не помечает сообщения прочитанными и не выполняет задачи", { timeout: 30000 }, async () => {
  await fixture(async page => {
    const initial = await snapshot(page);
    await activeTab(page).focus();
    await page.keyboard.press("End");
    await expect(historyTab(page)).toHaveAttribute("aria-selected", "true");
    await expect(historyTab(page)).toBeFocused();
    await page.keyboard.press("Home");
    await expect(activeTab(page)).toHaveAttribute("aria-selected", "true");
    await expect(activeTab(page)).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(historyTab(page)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowLeft");
    await expect(activeTab(page)).toHaveAttribute("aria-selected", "true");
    assert.deepEqual(await updates(page), []);
    assert.deepEqual(await snapshot(page), initial);
  });
});

test("уведомления: callback false и throw оставляют запись в текущем списке, показывают alert и снимают pending без ложного успеха", { timeout: 30000 }, async () => {
  await fixture(async page => {
    const initial = await snapshot(page);
    for (const failure of ["false", "throw"]) {
      await page.evaluate(failure => {
        window.notificationsScene.retry("active-task");
        window.notificationsScene.hold("active-task");
        window.notificationsScene[failure === "false" ? "fail" : "reject"]("active-task");
      }, failure);
      const row = item(page, "Проверить дневник питания");
      const toggle = row.getByTestId("profile-trainer-notification-toggle");
      await toggle.click();
      await expect(toggle).toBeDisabled();
      await expect(page.getByRole("alert")).toHaveCount(0);
      await page.evaluate(() => window.notificationsScene.release("active-task"));
      await expect(page.getByRole("alert")).toHaveText("Не удалось изменить отметку. Попробуйте ещё раз.");
      await expect(toggle).toBeEnabled();
      await expect(toggle).toHaveText("Отметить выполненным");
      await expect(activeTab(page)).toHaveText(/Актуальные\s*2/);
      await expect(historyTab(page)).toHaveText(/История\s*2/);
      await expect(row).not.toHaveAttribute("data-task-status", "completed");
      assert.deepEqual(await snapshot(page), initial);
    }
    assert.deepEqual(await updates(page), [
      { type: "update", id: "active-task", completed: true },
      { type: "update", id: "active-task", completed: true }
    ]);
  });
});

test("уведомления: повторное открытие выбирает Актуальные и очищает локальную ошибку без изменения исходных записей", { timeout: 30000 }, async () => {
  await fixture(async page => {
    const initial = await snapshot(page);
    await historyTab(page).click();
    await page.evaluate(() => window.notificationsScene.fail("completed-task"));
    await item(page, "Добавить замеры тела").getByRole("button", { name: "Вернуть в актуальные", exact: true }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(historyTab(page)).toHaveAttribute("aria-selected", "true");
    await page.getByRole("button", { name: "Закрыть уведомления", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Открыть тестовые уведомления" }).click();
    await expect(activeTab(page)).toHaveAttribute("aria-selected", "true");
    await expect(historyTab(page)).toHaveAttribute("aria-selected", "false");
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(item(page, "Проверить дневник питания")).toBeVisible();
    await expect(item(page, "Добавить замеры тела")).toHaveCount(0);
    assert.deepEqual(await snapshot(page), initial);
    assert.deepEqual(await updates(page), [{ type: "update", id: "completed-task", completed: false }]);
  });
});
