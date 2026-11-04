import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { transform } from "lightningcss";
import { chromium, expect } from "@playwright/test";

const source = path => fileURLToPath(new URL(`../src/${path}`, import.meta.url)).replaceAll("\\", "/");
const css = [];
const bundle = await rolldown({ input: "admin-profile-fixture", platform: "browser", transform: { jsx: { runtime: "automatic" } }, plugins: [{
  name: "admin-profile-local-react",
  resolveId(id) {
    if (id === "admin-profile-fixture") return id;
    if (id.endsWith("/adminOperationalApi")) return "admin-profile-api";
    if (id.endsWith("/firebase")) return "admin-profile-auth";
    if (id.endsWith("/AdminWorkspace")) return "admin-profile-shell";
    return null;
  },
  async load(id) {
    if (id.endsWith(".css")) {
      const sheet = transform({ filename: id, code: await readFile(id), cssModules: true, errorRecovery: false });
      css.push(sheet.code.toString());
      return { moduleType: "js", code: `export default ${JSON.stringify(Object.fromEntries(Object.entries(sheet.exports).map(([key, value]) => [key, value.name])))};` };
    }
    if (id === "admin-profile-auth") return { moduleType: "js", code: "export const auth={currentUser:{uid:'audit-admin'}};window.auditAuth=auth;" };
    if (id === "admin-profile-shell") return { moduleType: "jsx", code: "export default function Shell({children}){return <div>{children}</div>}" };
    if (id === "admin-profile-api") return { moduleType: "js", code: `
      export const getAdminOperationalUserId=user=>String(user?.id||user?.uid||'').trim();
      export const manageAdminTrainerInvite=payload=>window.auditApi('invite',payload);
      export const setAdminUserAccess=payload=>window.auditApi('access',payload);
      export const updateAdminUserRole=payload=>window.auditApi('role',payload);
      export const assignAdminClient=payload=>window.auditApi('assign',payload);
    ` };
    if (id !== "admin-profile-fixture") return null;
    return { moduleType: "jsx", code: `
      import React,{useState}from'react';import{createRoot}from'react-dom/client';
      import Profile from ${JSON.stringify(source("components/admin/AdminTrainerProfile.jsx"))};
      import Invite from ${JSON.stringify(source("components/admin/AdminTrainerInviteModal.jsx"))};
      import Route from ${JSON.stringify(source("features/trainer/AdminTrainerProfileRoute.jsx"))};
      import{auth}from'./firebase';
      import{advanceAuthSession}from ${JSON.stringify(source("utils/authSession.js"))};
      import{useModalFocusTrap}from ${JSON.stringify(source("shared/hooks/useModalFocusTrap.js"))};
      import{useAppBackNavigation}from ${JSON.stringify(source("shared/hooks/useAppBackNavigation.js"))};
      const trainer={id:'trainer-1',name:'Мария Новикова',login:'maria.fit',role:'trainer',accountStatus:'active',active:true};
      const other={id:'trainer-2',name:'Другой тренер',role:'trainer',accountStatus:'active',active:true};
      const clients=Array.from({length:4},(_,i)=>({id:'client-'+i,name:'Клиент '+(i+1),role:'client',assignedTrainerId:'trainer-1'}));
      window.auditCalls=[];window.auditHold=false;window.auditReject=false;window.auditStatus='accepted';window.auditQueue=[];window.auditStatusQueue=[];window.auditHoldStatus=false;window.auditCloseCalls=0;window.auditRefreshes=0;
      window.auditApi=async(kind,payload)=>{
        window.auditCalls.push({kind,...payload});
        if(kind==='invite'&&payload.action==='status'){const result={invite:{uid:payload.uid,status:window.auditStatus}};
          if(window.auditHoldStatus)return new Promise(resolve=>window.auditStatusQueue.push(()=>resolve(result)));return result;}
        if(window.auditHold)await new Promise((resolve,reject)=>window.auditQueue.push({resolve,reject}));
        if(window.auditReject)throw new Error('synthetic offline');
        if(kind==='access')return{user:{id:payload.uid,role:'trainer',active:true,accessDisabled:payload.action==='suspend',
          accountStatus:payload.action==='suspend'?'suspended':'invited',membershipStatus:payload.action==='suspend'?'suspended':'active'}};
        if(kind==='invite'){window.auditStatus=payload.action==='revoke'?'revoked':'pending';return{invite:{uid:payload.uid,status:window.auditStatus,shareUrl:payload.action==='revoke'?'':'https://example.test/invite/audit'}};}
        if(kind==='create')return{...payload,shareUrl:'https://example.test/invite/created'};
        return{user:{id:payload.uid,role:payload.role}};
      };
      function Scene(){const[mode,setMode]=useState('active'),[selected,setSelected]=useState(trainer),[users,setUsers]=useState([trainer,other]),[open,setOpen]=useState(true),[created,setCreated]=useState(null);
        useModalFocusTrap();useAppBackNavigation({isLoggedIn:true,appLoading:false,page:'admin',hasTransientScreen:false,isPrimaryPage:()=>true,handleTransientBack:()=>false});
        window.auditState={selected,users};
        window.profileScene={show:name=>{setMode(name);setSelected({...trainer,accountStatus:name==='route'?'invited':name});setUsers([trainer,other]);setOpen(true);setCreated(null);},
          selectOther:()=>setSelected(other),relogin:()=>advanceAuthSession(auth,auth.currentUser),release:()=>{window.auditHold=false;window.auditQueue.shift()?.resolve();},
          releaseStatus:()=>{window.auditHoldStatus=false;window.auditStatusQueue.shift()?.();},
          reject:()=>{window.auditHold=false;window.auditQueue.shift()?.reject(new Error('synthetic offline'));}};
        const pending=['pending','expired','missing'].includes(mode);
        const profileTrainer={...trainer,accountStatus:mode==='active'||mode==='unknown-assignments'?'active':mode,
          ...(mode==='revoked'?{membershipStatus:'revoked',accessDisabled:true,active:false}:{}),...(mode==='suspended'?{membershipStatus:'suspended',accessDisabled:true}:{})};
        if(mode==='route')return <Route selectedClient={selected} user={auth.currentUser} canUseAdminFeatures={()=>true} adminAllUsersList={users}
          adminTrainingTemplates={[]} setAdminAllUsersList={setUsers} setAdminSelectedClient={setSelected} loadUsers={()=>{window.auditRefreshes++;}}
          setAdminClientStatus={()=>{}} setAdminClientPageOpen={()=>{}} setPage={()=>{}} openAdminClientsWithFilter={()=>{}}/>;
        if(mode==='inviteForm')return <><button type='button' onClick={()=>setOpen(true)}>Открыть приглашение</button><Invite open={open} createdInvite={created}
          onClose={()=>{window.auditCloseCalls++;setOpen(false);}} onSubmit={async payload=>{const result=await window.auditApi('create',payload);setCreated(result);}}/></>;
        return <Profile trainer={profileTrainer} clients={mode==='active'?clients:[]} counts={{assignedClients:mode==='active'?4:0,assignmentsKnown:mode!=='unknown-assignments',programs:4,libraryExercises:18}}
          onBack={()=>{}} onOpenClients={()=>window.auditCalls.push({kind:'catalog'})} onOpenPrograms={()=>window.auditCalls.push({kind:'programs'})} onOpenLibrary={()=>window.auditCalls.push({kind:'library'})}
          onChangeRole={()=>window.auditApi('role',{uid:trainer.id,role:'client'})} onToggleAccess={payload=>window.auditApi('access',{uid:trainer.id,...payload})}
          onReassignClients={uid=>window.auditApi('assign',{trainerId:uid})} onDemoteWithReassignment={uid=>window.auditApi('role',{uid:trainer.id,role:'client',reassignClientsToUid:uid})}
          replacementTrainers={[other]} onResendInvite={async()=>{const result=await window.auditApi('invite',{uid:trainer.id,action:'resend'});setMode(result.invite.status);return result;}}
          onRevokeInvite={()=>window.auditApi('invite',{uid:trainer.id,action:'revoke'})}/>;
      }createRoot(document.getElementById('root')).render(<Scene/>);
    ` };
  }
}] });
const generated = await bundle.generate({ format: "iife", codeSplitting: false });
await bundle.close();
const code = generated.output.find(item => item.type === "chunk").code;
const profile = page => page.getByTestId("admin-trainer-profile");
const advanced = page => page.getByTestId("admin-trainer-advanced");
async function show(page, mode) { await page.evaluate(value => window.profileScene.show(value), mode); }
async function openAdvanced(page) { if (!await advanced(page).evaluate(details => details.open)) await advanced(page).locator("summary").click(); }
const calls = page => page.evaluate(() => window.auditCalls.filter(call => !(call.kind === "invite" && call.action === "status")));

async function fixture(run) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
    page.setDefaultTimeout(4000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => route.abort());
    await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><main id="root"></main>');
    await page.addStyleTag({ content: `body{margin:0;padding:16px;background:#f2f2f7;font-family:Arial,sans-serif}#root{max-width:1100px;margin:auto}${css.join("\n")}` });
    await page.addScriptTag({ content: code });
    await expect(profile(page)).toBeVisible();
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

test("профиль тренера: повседневные действия в начале, управление доступом отдельно, клиенты тренера не подменяются общим каталогом", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await expect(profile(page).getByRole("listitem")).toHaveCount(3);
    await expect(profile(page).getByRole("button", { name: "Изменить роль", exact: true, includeHidden: true })).toBeHidden();
    await profile(page).getByRole("button", { name: "Клиенты тренера", exact: true }).click();
    assert.match(await profile(page).getByRole("button", { name: "Клиенты тренера", exact: true }).evaluate(button => getComputedStyle(button).backgroundImage), /linear-gradient/);
    await expect(profile(page).getByRole("listitem")).toHaveCount(4);
    assert.deepEqual(await calls(page), []);
    await profile(page).getByRole("button", { name: "Каталог клиентов", exact: true }).click();
    await profile(page).getByRole("button", { name: "Программы", exact: true }).click();
    await profile(page).getByRole("button", { name: "Библиотека", exact: true }).click();
    assert.deepEqual((await calls(page)).map(call => call.kind), ["catalog", "programs", "library"]);
    await openAdvanced(page);
    await profile(page).getByRole("button", { name: "Изменить роль", exact: true }).click();
    const roleDialog = page.getByRole("dialog", { name: "Снять роль тренера?", exact: true });
    await expect(roleDialog).toContainText("ID: trainer-1");
    await expect(roleDialog.getByRole("button", { name: "Снять роль тренера", exact: true })).toHaveCount(0);
    await roleDialog.getByRole("button", { name: "Понятно", exact: true }).click();
    await profile(page).getByRole("button", { name: "Приостановить", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Приостановить доступ", exact: true })).toBeDisabled();
  });
});

test("профиль тренера: expired/missing не активны, revoked не предлагает запрещённые resend/restore", { timeout: 30000 }, async () => {
  await fixture(async page => {
    for (const [mode, label] of [["expired", "Срок приглашения истёк"], ["missing", "Приглашение не найдено"]]) {
      await show(page, mode);
      await expect(profile(page).getByRole("region", { name: "Карточка тренера Мария Новикова", exact: true }).getByText(label, { exact: true })).toBeVisible();
      await expect(profile(page).getByText("Активен", { exact: true })).toHaveCount(0);
      await expect(profile(page).getByRole("button", { name: "Отправить повторно", exact: true })).toBeVisible();
      const beforeCancel = (await calls(page)).length;
      await profile(page).getByRole("button", { name: "Отозвать", exact: true }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Отмена", exact: true }).click();
      assert.equal((await calls(page)).length, beforeCancel);
      await page.evaluate(() => { window.auditHold = true; });
      await profile(page).getByRole("button", { name: "Отправить повторно", exact: true }).click();
      await page.evaluate(() => window.profileScene.reject());
      await expect(profile(page).getByRole("alert")).toContainText("Не удалось отправить приглашение повторно");
      await expect(profile(page).getByRole("button", { name: "Отправить повторно", exact: true })).toBeEnabled();
      await profile(page).getByRole("button", { name: "Отправить повторно", exact: true }).click();
      await expect(profile(page).getByLabel("Ссылка активации для ручного копирования")).toHaveValue("https://example.test/invite/audit");
    }
    assert.equal((await calls(page)).length, 4);
    assert.ok((await calls(page)).every(call => call.action === "resend"));
    await show(page, "revoked");
    await expect(profile(page).getByRole("button", { name: "Отправить повторно", exact: true })).toHaveCount(0);
    await openAdvanced(page);
    await expect(profile(page).getByRole("button", { name: "Вернуть доступ", exact: true })).toHaveCount(0);
    await expect(profile(page)).toContainText("Повторная отправка и восстановление доступа для отозванного аккаунта недоступны.");
  });
});

test("профиль тренера: отзыв требует подтверждения конкретного аккаунта, pending защищён, ошибка допускает повтор", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await show(page, "pending");
    await profile(page).getByRole("button", { name: "Отозвать", exact: true }).click();
    const dialog = page.getByRole("alertdialog", { name: "Отозвать приглашение?", exact: true });
    await expect(dialog).toContainText("Мария Новикова · maria.fit · ID: trainer-1");
    assert.deepEqual(await calls(page), []);
    await page.evaluate(() => { window.auditHold = true; });
    await dialog.getByRole("button", { name: "Отозвать приглашение", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Отзываем…", exact: true })).toBeDisabled();
    await dialog.getByRole("button", { name: "Отзываем…", exact: true }).evaluate(button => { button.click(); button.click(); });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    assert.equal((await calls(page)).length, 1);
    await page.evaluate(() => window.profileScene.reject());
    await expect(dialog.getByRole("alert")).toContainText("Не удалось отозвать приглашение");
    await expect(dialog.getByRole("button", { name: "Отозвать приглашение", exact: true })).toBeEnabled();
    await dialog.getByRole("button", { name: "Отозвать приглашение", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    assert.equal((await calls(page)).length, 2);
  });
});

test("приглашение тренера: валидация, локальная блокировка, сохранение ввода и явный успех только после ответа", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await show(page, "inviteForm");
    const dialog = page.getByRole("dialog", { name: "Пригласить тренера", exact: true });
    await dialog.getByRole("button", { name: "Создать приглашение", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("Укажите имя тренера");
    assert.deepEqual(await calls(page), []);
    await dialog.getByLabel("Имя тренера", { exact: true }).fill("Мария");
    await dialog.getByLabel("Логин для входа", { exact: true }).fill("maria.fit");
    await page.evaluate(() => { window.auditHold = true; });
    await dialog.getByRole("button", { name: "Создать приглашение", exact: true }).click();
    await expect(dialog.getByLabel("Имя тренера", { exact: true })).toBeDisabled();
    await expect(dialog.getByRole("heading", { name: "Приглашение готово", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await page.evaluate(() => window.profileScene.reject());
    await expect(dialog.getByRole("alert")).toContainText(/повторите попытку/i);
    await expect(dialog.getByLabel("Имя тренера", { exact: true })).toHaveValue("Мария");
    await expect(dialog.getByLabel("Логин для входа", { exact: true })).toHaveValue("maria.fit");
    await dialog.getByRole("button", { name: "Создать приглашение", exact: true }).click();
    await expect(dialog.getByRole("heading", { name: "Приглашение готово", exact: true })).toBeVisible();
    await expect(dialog.getByLabel("Ссылка активации для ручного копирования")).toHaveValue("https://example.test/invite/created");
    assert.equal((await calls(page)).length, 2);
  });
});

test("профиль тренера: API ack обновляет selectedprofile, restore сохраняет приглашённый статус, а не membership active", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await page.evaluate(() => { window.auditStatus = "pending"; });
    await show(page, "route");
    await expect(profile(page).getByRole("region", { name: "Краткая статистика тренера", exact: true })).toContainText("упражнений в программах");
    await expect(profile(page).getByText("упражнений в библиотеке", { exact: true })).toHaveCount(0);
    await openAdvanced(page);
    await profile(page).getByRole("button", { name: "Приостановить", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Приостановить доступ", exact: true }).click();
    await expect(profile(page).getByRole("button", { name: "Вернуть доступ", exact: true })).toBeVisible();
    assert.equal(await page.evaluate(() => window.auditState.selected.accessDisabled), true);
    await profile(page).getByRole("button", { name: "Вернуть доступ", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Вернуть доступ", exact: true }).click();
    await expect(profile(page).getByRole("button", { name: "Отправить повторно", exact: true })).toBeVisible();
    assert.equal(await page.evaluate(() => window.auditState.selected.accountStatus), "invited");
    await expect(profile(page).getByText("Активен", { exact: true })).toHaveCount(0);
  });
});

test("профиль тренера: поздний ack не меняет другого выбранного тренера или новую сессию того же UID", { timeout: 30000 }, async () => {
  await fixture(async page => {
    for (const change of ["selectOther", "relogin"]) {
      await show(page, "route");
      await openAdvanced(page);
      await profile(page).getByRole("button", { name: "Приостановить", exact: true }).click();
      await page.evaluate(() => { window.auditHold = true; });
      await page.getByRole("dialog").getByRole("button", { name: "Приостановить доступ", exact: true }).click();
      await page.evaluate(value => window.profileScene[value](), change);
      if (change === "selectOther") await expect(profile(page).getByRole("heading", { name: "Другой тренер", exact: true })).toBeVisible();
      await page.evaluate(async () => { window.profileScene.release(); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
      await expect.poll(() => page.evaluate(() => window.auditState.selected.accessDisabled === true)).toBe(false);
      assert.equal(await page.evaluate(() => window.auditState.users.find(user => user.id === "trainer-1").accessDisabled === true), false, change);
      if (change === "selectOther") await expect(profile(page).getByRole("heading", { name: "Другой тренер", exact: true })).toBeVisible();
      else await expect(page.getByRole("dialog").getByRole("button", { name: "Приостановить доступ", exact: true })).toBeEnabled();
      await show(page, "active");
    }
  });
});

test("профиль тренера: старый status-read не возвращает pending после подтверждённого отзыва", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await page.evaluate(() => { window.auditStatus = "pending"; window.auditHoldStatus = true; });
    await show(page, "route");
    await expect.poll(() => page.evaluate(() => window.auditStatusQueue.length)).toBe(1);
    await profile(page).getByRole("button", { name: "Отозвать", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Отозвать приглашение", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(profile(page).getByRole("button", { name: "Отправить повторно", exact: true })).toHaveCount(0);
    await page.evaluate(async () => { window.profileScene.releaseStatus(); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    await expect(profile(page).getByRole("region", { name: "Карточка тренера Мария Новикова", exact: true }).getByText("Приглашение отозвано", { exact: true })).toBeVisible();
    await expect(profile(page).getByRole("button", { name: "Отправить повторно", exact: true })).toHaveCount(0);
    assert.equal(await page.evaluate(() => window.auditState.selected.membershipStatus), "revoked");
  });
});

test("профиль и приглашение тренера: 44px controls и отсутствие горизонтального overflow на 320/402/1440", { timeout: 30000 }, async () => {
  await fixture(async page => {
    for (const viewport of [{ width: 320, height: 720 }, { width: 402, height: 874 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await show(page, "active");
      await openAdvanced(page);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const undersized = await profile(page).locator('button, summary').evaluateAll(elements => elements.filter(element => element.getClientRects().length).map(element => ({
        text: element.textContent, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height
      })).filter(rect => rect.width < 43.9 || rect.height < 43.9));
      assert.deepEqual(undersized, []);
      if (viewport.width === 402 || viewport.width === 1440) { await mkdir("output/playwright", { recursive: true }); await page.screenshot({ path: `output/playwright/admin-trainer-profile-${viewport.width}.png`, fullPage: true }); }
      await show(page, "inviteForm");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await expect(page.getByRole("dialog", { name: "Пригласить тренера", exact: true })).toBeVisible();
    }
  });
});
