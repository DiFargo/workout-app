import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { transform } from "lightningcss";
import { chromium, expect } from "@playwright/test";
import { isAdminAssignableTrainer } from "../src/utils/adminAssignableTrainer.js";

const apiSource = await readFile(
  new URL("../src/features/trainer/adminOperationalApi.js", import.meta.url),
  "utf8"
);
const usersRouteSource = await readFile(
  new URL("../src/features/trainer/AdminUsersWorkspaceRoute.jsx", import.meta.url),
  "utf8"
);
const trainerRouteSource = await readFile(
  new URL("../src/features/trainer/AdminTrainerProfileRoute.jsx", import.meta.url),
  "utf8"
);
const trainerProfileSource = await readFile(
  new URL("../src/components/admin/AdminTrainerProfile.jsx", import.meta.url),
  "utf8"
);
const hubSource = await readFile(
  new URL("../src/components/admin/AdminPanelHub.jsx", import.meta.url),
  "utf8"
);

test("admin operational API keeps privileged lifecycle requests behind authorized POST calls", () => {
  assert.match(apiSource, /fetchAuthorizedWithTimeout/);
  assert.match(apiSource, /"\/api\/admin\/assign-client"/);
  assert.match(apiSource, /"\/api\/admin\/set-user-access"/);
  assert.match(apiSource, /"\/api\/admin\/update-user-role"/);
  assert.match(apiSource, /"\/api\/admin\/trainer-invite"/);
});

test("administrator can assign or clear a trainer assignment from the user directory", () => {
  assert.match(usersRouteSource, /<AdminClientAssignmentModal/);
  assert.match(usersRouteSource, /assignAdminClient\(\{ clientId, trainerId:/);
  assert.match(usersRouteSource, /onAssignTrainer=\{openClientAssignment\}/);
});

test("trainer profile exposes safe reassignment, access and invitation lifecycle controls", () => {
  assert.match(trainerRouteSource, /manageAdminTrainerInvite\(\{ uid: trainerId, action: "status" \}\)/);
  assert.match(trainerRouteSource, /setAdminUserAccess\(\{ uid: trainerId, action \}\)/);
  assert.match(trainerRouteSource, /assignAdminClient\(\{ clientId, trainerId: targetTrainerId \}\)/);
  assert.match(trainerRouteSource, /reassignClientsToUid: targetTrainerId/);
  assert.match(trainerProfileSource, /onDemoteWithReassignment/);
  assert.match(trainerProfileSource, /confirmDemoteWithReassignment/);
  assert.match(trainerProfileSource, /Переназначить клиентов/);
  assert.match(trainerProfileSource, /Отправить повторно/);
  assert.match(trainerProfileSource, /Приостановить/);
});

test("admin overview surfaces action queue entries for assignments, invitations and access", () => {
  assert.match(hubSource, /id: "unassigned-clients"/);
  assert.match(hubSource, /id: "pending-invites"/);
  assert.match(hubSource, /id: "suspended-trainers"/);
  assert.match(hubSource, /onOverviewQueueAction=\{openQueueItem\}/);
});

test("assignable trainer candidates reject inactive membership but allow pending invitations", () => {
  const active = Object.freeze({ id: "trainer", role: "trainer", active: true });
  for (const patch of [{}, { accountStatus: "pending" }, { accountStatus: "invited" }, { accountStatus: "created" }]) {
    assert.equal(isAdminAssignableTrainer({ ...active, ...patch }), true);
  }
  for (const patch of [{ active: false }, { archived: true }, { accessDisabled: true }, { disabled: true },
    { membershipStatus: "revoked" }, { membershipStatus: "suspended" }, { accountStatus: "blocked" },
    { status: "inactive" }, { accountAccessStatus: "awaiting_trainer" }, { role: "client" }, { role: "coach" }, { id: "" }]) {
    assert.equal(isAdminAssignableTrainer({ ...active, ...patch }), false, JSON.stringify(patch));
  }
  assert.equal(isAdminAssignableTrainer(null), false);
});

const sourcePath = name => fileURLToPath(new URL(`../src/${name}`, import.meta.url)).replaceAll("\\", "/");
const css = [];
const bundle = await rolldown({ input: "admin-directory-scene", platform: "browser", transform: { jsx: { runtime: "automatic" } }, plugins: [{
  name: "actual-admin-directory-with-local-transport",
  resolveId(id) {
    if (id === "admin-directory-scene") return id;
    if (/(?:^|\/)apiClient(?:\.js)?$/.test(id)) return "admin-directory-api";
    if (/(?:^|\/)AdminWorkspace(?:\.jsx)?$/.test(id)) return "admin-directory-shell";
    if (/(?:^|\/)AdminTrainerInviteModal(?:\.jsx)?$/.test(id)) return "admin-directory-invite";
    return null;
  },
  async load(id) {
    if (id.endsWith(".css")) {
      const result = transform({ filename: id, code: await readFile(id), cssModules: true, errorRecovery: false });
      css.push(result.code.toString());
      return { moduleType: "js", code: `export default ${JSON.stringify(Object.fromEntries(Object.entries(result.exports).map(([key, value]) => [key, value.name])))};` };
    }
    if (id === "admin-directory-shell") return { moduleType: "jsx", code: "export default function Shell({children}){return <main>{children}</main>} export const getAdminRecoveryAccountLabel=user=>user.name;" };
    if (id === "admin-directory-invite") return "export default function Invite(){return null;}";
    if (id === "admin-directory-api") return `
      window.directoryApi={calls:[],mode:'success',release:null};
      export async function fetchAuthorizedWithTimeout(path,options){const api=window.directoryApi,payload=JSON.parse(options.body);api.calls.push({path,payload});
        const mode=api.mode;if(mode==='hold')await new Promise(resolve=>{api.release=resolve});
        return {ok:mode!=='fail',status:mode==='fail'?409:200,json:async()=>mode==='fail'?{error:'operation-rejected'}:
          path.endsWith('update-user-role')?{ok:true,user:{id:payload.uid,role:payload.role}}:
          {ok:true,client:{id:payload.clientId,assignedTrainerId:payload.trainerId||'',trainerId:payload.trainerId||''}}};}
    `;
    if (id !== "admin-directory-scene") return null;
    return { moduleType: "jsx", code: `
      import React,{useState}from'react';import{createRoot}from'react-dom/client';
      import Route from ${JSON.stringify(sourcePath("features/trainer/AdminUsersWorkspaceRoute.jsx"))};
      import{useModalFocusTrap}from ${JSON.stringify(sourcePath("shared/hooks/useModalFocusTrap.js"))};
      import{useAppBackNavigation}from ${JSON.stringify(sourcePath("shared/hooks/useAppBackNavigation.js"))};
      const baseUsers=[
        {id:'client-1',name:'Анна Ковалёва',role:'client',email:'anna@example.test',loginLower:'anna_login',telegram:{username:'anna_training',telegramUserId:'123456'},assignedTrainerId:'trainer-active'},
        {id:'client-blocked',name:'Мария Сидорова',role:'client',membershipStatus:'suspended'},
        {id:'client-archive',name:'Иван Архивный',role:'client',archived:true},
        {id:'trainer-active',name:'Алексей Тренер',role:'trainer'},
        {id:'trainer-pending',name:'Ольга Приглашённая',role:'trainer',accountStatus:'pending'},
        {id:'trainer-archive',name:'Архивный тренер',role:'trainer',archived:true},
        {id:'trainer-revoked',name:'Отозванный тренер',role:'trainer',membershipStatus:'revoked'},
        {id:'admin',name:'Администратор',role:'admin'}];
      window.directoryConfirms=[];window.directoryConfirmed=false;
      function Scene(){useModalFocusTrap();useAppBackNavigation({isLoggedIn:true,appLoading:false,page:'admin-users',hasTransientScreen:false,isPrimaryPage:()=>true,handleTransientBack:()=>false});
        const[users,setUsers]=useState(baseUsers),[role,setRole]=useState('all'),[filter,setFilter]=useState('all'),[search,setSearch]=useState(''),
          [status,setStatus]=useState(''),[loading,setLoading]=useState(false),[allowed,setAllowed]=useState(true);
        window.directoryScene={state:()=>({users,role,filter,search}),scenario:({empty=false,loading=false,error='',allowed=true,queue='all',long=false}={})=>{
          setUsers(empty?[]:long?baseUsers.map((item,index)=>index?item:{...item,name:'Анна Александровна Константинопольская с очень длинной фамилией',email:'very.long.email.address.for.layout@example.test'}):baseUsers);
          setLoading(loading);setStatus(error);setAllowed(allowed);setSearch('');setRole('all');setFilter(queue);}};
        return <Route adminAllUsersList={users} adminUsersSelectedTab={role} adminClientFilter={filter} adminUsersSearch={search} adminClientStatus={status}
          trainerClientSummariesLoading={loading} canUseAdminFeatures={()=>allowed} setAdminAllUsersList={setUsers} setAdminUsersSelectedTab={setRole}
          setAdminClientFilter={setFilter} setAdminUsersSearch={setSearch} setAdminClientStatus={setStatus} loadUsers={()=>Promise.resolve()}
          showAppConfirm={async options=>{window.directoryConfirms.push(options);return window.directoryConfirmed}}
          loadAdminClientOverview={client=>{window.directoryOpened=client.id}} setAdminSelectedClient={client=>{window.directoryOpened=client?.id}} setAdminClientPageOpen={()=>{}} setPage={()=>{}}/>;
      }createRoot(document.getElementById('root')).render(<Scene/>);
    ` };
  }
}] });
const generated = await bundle.generate({ format: "iife", codeSplitting: false });
await bundle.close();
const sceneCode = generated.output.find(item => item.type === "chunk").code;
const directory = page => page.getByTestId("admin-users-workspace");
const annaRow = page => directory(page).locator("article").filter({ hasText: "Анна Ковалёва" });

async function directoryFixture(run) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
    page.setDefaultTimeout(4000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => route.abort());
    await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>');
    await page.addStyleTag({ content: `:root{--ownset-action-gradient:linear-gradient(115deg,#467b72 0%,#3e748b 54%,#3565a3 100%)}body{margin:0;padding:12px;background:#f2f2f7;font-family:Arial,sans-serif}${css.join("\n")}` });
    await page.addScriptTag({ content: sceneCode });
    await expect(directory(page)).toBeVisible();
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

test("каталог: поиск по имени/логину/email/Telegram/ID, сочетание роли и статуса и полный сброс без API", { timeout: 30000 }, async () => {
  await directoryFixture(async page => {
    const search = directory(page).getByRole("searchbox", { name: "Найти пользователя" });
    for (const query of ["КОВАЛЕВА анна", "anna_login", "anna@example.test", "@ANNA_TRAINING", "123456", "client-1"]) {
      await search.fill(query);
      await expect(directory(page).locator("article")).toHaveCount(1);
      await expect(annaRow(page)).toBeVisible();
    }
    await directory(page).getByRole("button", { name: "Очистить поиск", exact: true }).click();
    await expect(directory(page).locator("article")).toHaveCount(8);
    await page.evaluate(() => window.directoryScene.scenario({ queue: "unassigned-clients" }));
    await expect(directory(page)).toContainText("Клиенты без тренера");
    await directory(page).getByRole("button", { name: "Сбросить поиск и фильтры", exact: true }).click();
    await expect(directory(page).locator("article")).toHaveCount(8);
    assert.equal((await page.evaluate(() => window.directoryScene.state())).filter, "all");
    await directory(page).getByRole("group", { name: "Фильтр по роли" }).getByRole("button", { name: /^Клиенты:/ }).click();
    await directory(page).getByRole("combobox", { name: "Состояние" }).selectOption("blocked");
    await expect(directory(page).locator("article")).toHaveCount(1);
    await expect(directory(page)).toContainText("Мария Сидорова");
    await expect(directory(page)).toContainText("Показано 1 из 8");
    await search.fill("нет такого");
    await expect(directory(page)).toContainText("Ничего не найдено");
    await directory(page).getByRole("button", { name: "Показать всех пользователей", exact: true }).click();
    await expect(search).toHaveValue("");
    await expect(directory(page).getByRole("combobox", { name: "Состояние" })).toHaveValue("all");
    await expect(directory(page).locator("article")).toHaveCount(8);
    assert.deepEqual(await page.evaluate(() => window.directoryApi.calls), []);
  });
});

test("каталог: loading/error не становятся ложным empty, загруженные строки сохраняются, non-admin не получает UI", { timeout: 30000 }, async () => {
  await directoryFixture(async page => {
    await page.evaluate(() => window.directoryScene.scenario({ empty: true, loading: true }));
    await expect(directory(page)).toContainText("Загружаем пользователей…");
    await expect(directory(page).getByText("Пользователей пока нет", { exact: true })).toHaveCount(0);
    await page.evaluate(() => window.directoryScene.scenario({ empty: true, error: "Не удалось загрузить пользователей." }));
    await expect(directory(page)).toContainText("Список не загружен");
    await expect(directory(page).getByText("Пользователей пока нет", { exact: true })).toHaveCount(0);
    await page.evaluate(() => window.directoryScene.scenario({ error: "Не удалось загрузить пользователей." }));
    await expect(directory(page).locator("article")).toHaveCount(8);
    await expect(directory(page)).toContainText("Показываем ранее загруженные аккаунты.");
    await page.evaluate(() => window.directoryScene.scenario({ empty: true }));
    await expect(directory(page)).toContainText("Пользователей пока нет");
    await page.evaluate(() => window.directoryScene.scenario({ allowed: false }));
    await expect(directory(page)).toHaveCount(0);
    assert.deepEqual(await page.evaluate(() => window.directoryApi.calls), []);
  });
});

test("назначение: только допустимые тренеры, pending разрешён, снять назначение можно лишь после отдельного подтверждения", { timeout: 30000 }, async () => {
  await directoryFixture(async page => {
    await annaRow(page).getByRole("button", { name: /^Изменить назначение тренера/ }).click();
    const modal = page.getByRole("dialog", { name: "Сменить тренера", exact: true });
    const select = modal.getByRole("combobox", { name: "Тренер", exact: true });
    await expect(select).toHaveValue("trainer-active");
    assert.deepEqual(await select.locator("option").evaluateAll(options => options.map(option => option.value)), ["", "trainer-active", "trainer-pending"]);
    await expect(select.locator('option[value="trainer-pending"]')).toContainText("ожидает активации");
    await select.selectOption("trainer-pending");
    await modal.getByRole("button", { name: "Сменить тренера", exact: true }).click();
    await expect(modal).toHaveCount(0);
    assert.deepEqual(await page.evaluate(() => window.directoryApi.calls), [{ path: "/api/admin/assign-client", payload: { clientId: "client-1", trainerId: "trainer-pending" } }]);
    await annaRow(page).getByRole("button", { name: /^Изменить назначение тренера/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Снять назначение", exact: true }).click();
    const confirm = page.getByRole("alertdialog", { name: "Снять назначение?", exact: true });
    await expect(confirm).toContainText("закроется доступ к тренировкам, питанию и прогрессу");
    await expect(confirm).toContainText("ID: client-1");
    assert.equal((await page.evaluate(() => window.directoryApi.calls)).length, 1);
    await confirm.getByRole("button", { name: "Подтвердить снятие назначения", exact: true }).click();
    await expect(confirm).toHaveCount(0);
    assert.deepEqual((await page.evaluate(() => window.directoryApi.calls)).at(-1), { path: "/api/admin/assign-client", payload: { clientId: "client-1" } });
  });
});

test("смена роли: отдельное подтверждение, отмена без POST, pending без дублей, отказ API не меняет роль", { timeout: 30000 }, async () => {
  await directoryFixture(async page => {
    const row = annaRow(page);
    const action = row.getByRole("button", { name: "Изменить роль Анна Ковалёва на «Тренер»", exact: true });
    await expect(action).toBeHidden();
    await row.locator("summary").click();
    await action.click();
    assert.deepEqual(await page.evaluate(() => window.directoryApi.calls), []);
    assert.match((await page.evaluate(() => window.directoryConfirms))[0].text, /ID: client-1.*Это смена роли, а не назначение тренера клиенту/);
    await page.evaluate(() => { window.directoryConfirmed = true; window.directoryApi.mode = "fail"; });
    await action.click();
    await expect(row.getByRole("alert")).toContainText("Не удалось подтвердить смену роли");
    await expect(row.getByRole("button", { name: "Обновить список", exact: true })).toBeVisible();
    assert.equal((await page.evaluate(() => window.directoryScene.state().users.find(user => user.id === "client-1"))).role, "client");
    await page.evaluate(() => { window.directoryApi.calls = []; window.directoryApi.mode = "hold"; });
    await action.click();
    await expect(action).toBeDisabled();
    await action.evaluate(button => { button.click(); button.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    assert.equal((await page.evaluate(() => window.directoryApi.calls)).length, 1);
    await page.evaluate(() => window.directoryApi.release());
    await expect(row).toContainText("изменена на «Тренер»");
    assert.equal((await page.evaluate(() => window.directoryScene.state().users.find(user => user.id === "client-1"))).role, "trainer");
  });
});

test("назначение: ошибка сохраняет выбранного тренера, повтор pending блокирует закрытие и дубли", { timeout: 30000 }, async () => {
  await directoryFixture(async page => {
    await annaRow(page).getByRole("button", { name: /^Изменить назначение тренера/ }).click();
    const modal = page.getByRole("dialog", { name: "Сменить тренера", exact: true });
    const select = modal.getByRole("combobox", { name: "Тренер", exact: true });
    const submit = modal.getByRole("button", { name: "Сменить тренера", exact: true });
    await select.selectOption("trainer-pending");
    await page.evaluate(() => { window.directoryApi.mode = "fail"; });
    await submit.click();
    await expect(modal.getByRole("alert")).toContainText("Не удалось сохранить назначение");
    await expect(select).toHaveValue("trainer-pending");
    assert.equal((await page.evaluate(() => window.directoryScene.state().users.find(user => user.id === "client-1"))).assignedTrainerId, "trainer-active");
    await page.evaluate(() => { window.directoryApi.calls = []; window.directoryApi.mode = "hold"; });
    await submit.click();
    const pending = modal.getByRole("button", { name: "Сохраняем…", exact: true });
    await expect(pending).toBeDisabled();
    await expect(select).toBeDisabled();
    await pending.evaluate(button => button.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await page.keyboard.press("Escape");
    await modal.locator("..").click({ position: { x: 1, y: 1 } });
    await expect(modal).toBeVisible();
    assert.equal((await page.evaluate(() => window.directoryApi.calls)).length, 1);
    await page.evaluate(() => window.directoryApi.release());
    await expect(modal).toHaveCount(0);
    assert.equal((await page.evaluate(() => window.directoryScene.state().users.find(user => user.id === "client-1"))).assignedTrainerId, "trainer-pending");
  });
});

test("каталог и назначение: 320/402/1440 без overflow, действия и фильтры доступны с клавиатуры", { timeout: 30000 }, async () => {
  await directoryFixture(async page => {
    await page.evaluate(() => window.directoryScene.scenario({ long: true }));
    for (const viewport of [{ width: 320, height: 720 }, { width: 402, height: 874 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const roles = directory(page).getByRole("group", { name: "Фильтр по роли" }).getByRole("button");
      for (const button of await roles.all()) {
        const box = await button.boundingBox();
        assert.ok(box.height >= 44);
      }
      if (viewport.width < 500) {
        await mkdir("output/playwright", { recursive: true });
        await page.screenshot({ path: `output/playwright/admin-directory-${viewport.width}.png`, fullPage: true });
      }
    }
    const clients = directory(page).getByRole("group", { name: "Фильтр по роли" }).getByRole("button", { name: /^Клиенты:/ });
    await clients.focus(); await page.keyboard.press("Enter");
    await expect(clients).toHaveAttribute("aria-pressed", "true");
    await page.setViewportSize({ width: 320, height: 720 });
    await directory(page).locator("article").first().getByRole("button", { name: /^Изменить назначение тренера/ }).click();
    await expect(page.getByRole("dialog", { name: "Сменить тренера", exact: true })).toBeVisible();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: "output/playwright/admin-assignment-320.png" });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
