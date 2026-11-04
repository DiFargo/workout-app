import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { chromium, expect } from "@playwright/test";
import { createBasicProgramMutation, formatBasicProgramWorkoutsForEditing, parseBasicProgramWorkoutsForEditing } from "../src/utils/adminBasicProgramLifecycle.js";

const workouts = [{ id: "stable-day", name: "Day", exercises: [{ id: "stable-ex", name: "Press", sets: [{ reps: 8, weight: 20 }], video: "video.mp4", requiresWeight: true, custom: { keep: true } }], taskBlocks: [{ id: "block", exerciseIds: ["stable-ex"], rounds: 3 }] }, { id: "day-2", name: "Next", exercises: [{ id: "ex-2", name: "Row", reps: 12 }] }];
test("existing basic prescriptions survive rename/copy and one-day editing without touching published data", () => {
  const published = createBasicProgramMutation({ draft: { title: "Original", workouts }, status: "published" }).record;
  const original = structuredClone(published);
  const parsed = parseBasicProgramWorkoutsForEditing(formatBasicProgramWorkoutsForEditing(published.workouts));
  const renamed = createBasicProgramMutation({ current: published, draft: { title: "Renamed", workouts: parsed }, status: "draft" }).record;
  assert.deepEqual(renamed.workouts, published.workouts);
  parsed[0].exercises[0].name = "New press";
  const edited = createBasicProgramMutation({ draft: { title: "Copy", workouts: parsed } }).record;
  assert.deepEqual(edited.workouts[1], published.workouts[1]);
  assert.deepEqual(edited.workouts[0].exercises[0].sets, workouts[0].exercises[0].sets);
  assert.deepEqual(edited.workouts[0].taskBlocks, workouts[0].taskBlocks);
  assert.equal(edited.workouts[0].exercises[0].id, "stable-ex");
  assert.deepEqual(published, original);
  assert.throws(() => parseBasicProgramWorkoutsForEditing("Day: Press"));
  assert.throws(() => parseBasicProgramWorkoutsForEditing('[{"exercises":null}]'));
});

const source = (name) => JSON.stringify(fileURLToPath(new URL(`../src/${name}`, import.meta.url)).replaceAll("\\", "/"));
const bundle = await rolldown({
  input: "remediation-admin-entry", platform: "browser", transform: { jsx: { runtime: "automatic" } },
  plugins: [{
    name: "remediation-admin", resolveId: id => id === "remediation-admin-entry" ? id : id === "firebase/firestore" ? "remediation-firestore" : /\/firebase$/.test(id) ? "remediation-firebase" : null,
    load(id) {
      if (id.endsWith(".css")) return { code: "export default {};", moduleType: "js" };
      if (id === "remediation-firebase") return "export const auth = {}; export const db = {};";
      if (id === "remediation-firestore") return "export const collection=()=>({}),doc=()=>({}),getDocs=async()=>({docs:[]}),serverTimestamp=()=>null,writeBatch=()=>({});";
      if (id !== "remediation-admin-entry") return null;
      return { moduleType: "jsx", code: `import React from 'react'; import {createRoot} from 'react-dom/client';
        import Profile from ${source("components/admin/AdminTrainerProfile.jsx")};
        import Invite from ${source("components/admin/AdminTrainerInviteModal.jsx")};
        import Users from ${source("components/admin/AdminUsersWorkspace.jsx")};
        import Journal from ${source("components/trainer/TrainerDailyJournal.jsx")};
        import {ProgramEditorSheet} from ${source("components/admin/AdminBasicProgramLifecycle.jsx")};
        const root=createRoot(document.getElementById('root')); let key=0;
        window.show=(kind)=>{window.calls=0;window.saved=null;root.render(<React.Fragment key={++key}>{kind==='profile'?<Profile trainer={{id:'trainer',name:'Trainer',accountStatus:'invited'}} onResendInvite={async()=>{window.calls++;return {shareUrl:'https://example.test/invite'}}}/>:kind==='invite'?<Invite open createdInvite={{shareUrl:'https://example.test/invite'}}/>:kind==='editor'?<ProgramEditorSheet mode='edit' program={{title:'Original',workouts:${JSON.stringify(workouts)}}} onClose={()=>{}} onSave={draft=>window.saved=draft}/>:<Users users={[{id:'client',name:'Client',role:'client'}]} onRetry={()=>window.refreshed=true} onPromoteToTrainer={async()=>{window.calls++;throw new Error(window.failure||'offline')}}/>}</React.Fragment>)};
        window.showJournal=(data)=>root.render(<Journal key={++key} actionCenter={data} renderAvatar={()=>null}/>);
        window.addEventListener('unhandledrejection',()=>window.unhandled=true);` };
    }
  }]
});
const generated = await bundle.generate({ format: "iife" });
await bundle.close();

test("actual React editor, promotion failure and clipboard outcomes remain truthful", { timeout: 60000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
    await page.setContent('<main id="root"></main>');
    await page.addScriptTag({ content: generated.output[0].code });
    await page.evaluate(() => window.showJournal({}));
    await expect(page.getByText("В журнале пока нет событий. Здесь появится хронология активности клиентов за день.", { exact: true })).toBeVisible();
    await expect(page.getByText(/Незакрытые задачи показаны выше/)).toHaveCount(0);
    await page.evaluate(() => window.showJournal({ priorityItems: [{ clientId: "test", client: { id: "test", name: "Client" }, summary: {}, status: { id: "noProgram" } }] }));
    await expect(page.getByRole("region", { name: "Действия, которые нужно выполнить сейчас" })).toBeVisible();
    await expect(page.getByText(/Незакрытые задачи показаны выше/)).toBeVisible();
    await page.evaluate(() => window.showJournal({ todayWorkouts: [{ clientId: "test", client: { id: "test", name: "Client" } }] }));
    await expect(page.getByText("Запланирована тренировка", { exact: true })).toBeVisible();
    await expect(page.getByText(/Незакрытые задачи показаны выше/)).toHaveCount(0);
    await page.getByRole("button", { name: /^Просмотренные/ }).click();
    await expect(page.getByText("По этому фильтру событий нет.", { exact: true })).toBeVisible();
    await page.evaluate(() => window.show("editor"));
    await page.getByLabel("Название", { exact: true }).fill("Renamed");
    assert.equal(await page.getByText("Расширенный редактор состава (JSON)", { exact: true }).evaluate(element => element.parentElement.open), false);
    await page.getByRole("button", { name: "Сохранить черновик" }).click();
    assert.deepEqual(await page.evaluate(() => window.saved.workouts), workouts, "title-only save keeps the original structured prescription");
    await page.getByLabel("Упражнение 1.1").fill("Updated press");
    await page.getByRole("button", { name: "Сохранить черновик" }).click();
    const saved = await page.evaluate(() => window.saved);
    assert.equal(saved.title, "Renamed");
    assert.deepEqual(saved.workouts[0].exercises[0], { ...workouts[0].exercises[0], name: "Updated press" });
    assert.deepEqual(saved.workouts[1], workouts[1]);

    for (const failure of ["403", "429", "offline"]) {
      await page.evaluate(value => { window.failure=value; window.show("users"); }, failure);
      await page.getByText("Управление ролью", { exact: true }).click();
      const promote = page.getByRole("button", { name: 'Изменить роль Client на «Тренер»' });
      await promote.click();
      await expect(page.getByRole("alert")).toContainText("Обновите список");
      await expect(promote).toBeEnabled();
      assert.equal(await page.evaluate(() => Boolean(window.unhandled)), false);
      await page.getByRole("button", { name: "Обновить список", exact: true }).click();
      assert.equal(await page.evaluate(() => window.refreshed), true);
    }

    for (const kind of ["profile", "invite"]) {
      await page.evaluate(value => window.show(value), kind);
      if (kind === "profile") await page.getByRole("button", { name: "Отправить повторно" }).click();
      const fallback = page.getByLabel("Ссылка активации для ручного копирования");
      await expect(fallback).toHaveValue("https://example.test/invite");
      await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined }));
      await page.getByRole("button", { name: "Скопировать ссылку", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("вручную");
      await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } }));
      await page.getByRole("button", { name: "Скопировать ссылку", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("вручную");
      await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async value => { window.copied=value; } } }));
      await page.getByRole("button", { name: "Скопировать ссылку", exact: true }).click();
      await expect(kind === "profile" ? page.getByRole("status") : page.getByRole("button", { name: "Ссылка скопирована", exact: true })).toContainText(/скопирована/);
      assert.equal(await page.evaluate(() => window.copied), "https://example.test/invite");
      if (kind === "profile") assert.equal(await page.evaluate(() => window.calls), 1, "copy retry must not resend invitation");
    }
  } finally { await browser.close(); }
});
