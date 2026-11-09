import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { chromium, expect } from "@playwright/test";

const source = name => JSON.stringify(fileURLToPath(new URL(`../src/${name}`, import.meta.url)).replaceAll("\\", "/"));
const dialogCss = await readFile(new URL("../src/utils/appFeedback.module.css", import.meta.url), "utf8");
const bundle = await rolldown({
  input: "profile-cabinet-logout-scene", platform: "browser", transform: { jsx: { runtime: "automatic" } },
  plugins: [{
    name: "real-cabinet-and-confirm-without-network",
    resolveId: id => id === "profile-cabinet-logout-scene" ? id : null,
    load(id) {
      if (id.endsWith(".css")) return { moduleType: "js", code: "export default new Proxy({}, { get: (_, key) => String(key) });" };
      if (id !== "profile-cabinet-logout-scene") return null;
      return { moduleType: "jsx", code: `
        import React from 'react';import{createRoot}from'react-dom/client';
        import TitleRow from ${source("features/client/profile/ProfileCabinetTitleRow.jsx")};
        import ActionGrid from ${source("features/client/profile/ProfileCabinetActionGrid.jsx")};
        import{useModalFocusTrap}from ${source("shared/hooks/useModalFocusTrap.js")};
        const client=location.hash!=='#staff',state={logoutCalls:0,refreshCalls:0,results:[]};let pending=null;
        const onLogout=async()=>{state.logoutCalls++;const result=await new Promise(resolve=>{pending=resolve});state.results.push(result);return result;};
        window.cabinetScene={state:()=>({...state,results:[...state.results]}),settle(value){if(!pending)throw new Error('No logout pending');const resolve=pending;pending=null;resolve(value);}};
        function Scene(){useModalFocusTrap();return <>
          <TitleRow clientAppearance={client} onRefresh={()=>state.refreshCalls++} onLogout={onLogout}/>
          <ActionGrid showClientOnlyActions={client} displayName='Тестовый профиль' email='fixture@example.test'
            telegramUsername='fixture' workoutModeLabel='Индивидуальная программа' onLogout={onLogout}/>
        </>;}
        createRoot(document.getElementById('root')).render(<Scene/>);
      ` };
    }
  }]
});
const generated = await bundle.generate({ format: "iife", codeSplitting: false });
await bundle.close();
const sceneCode = generated.output.find(item => item.type === "chunk").code;

async function fixture(run, { staff = false } = {}) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
    page.setDefaultTimeout(4000);
    const errors = [], requests = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => { requests.push(route.request().url()); return route.abort(); });
    await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="root"></main></body></html>');
    if (staff) await page.evaluate(() => { location.hash = "staff"; });
    await page.addStyleTag({ content: `body{margin:0;font-family:Arial,sans-serif}*{box-sizing:border-box}button{cursor:pointer}${dialogCss}` });
    await page.addScriptTag({ content: sceneCode });
    await expect(page.getByTestId("profile-cabinet-title")).toHaveText("Кабинет");
    await run(page);
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, [], "Проверка кабинета не должна обращаться к Firebase или внешней сети");
  } finally { await browser.close(); }
}

const state = page => page.evaluate(() => window.cabinetScene.state());
const header = page => page.getByTestId("profile-cabinet-title-row");
const exit = page => page.getByTestId("profile-cabinet-logout");
const confirmation = page => page.getByRole("dialog", { name: "Выйти из аккаунта?", exact: true });

async function openConfirmation(page) {
  await exit(page).click();
  await expect(confirmation(page)).toBeVisible();
  await expect(exit(page)).toBeDisabled();
  await expect(confirmation(page).getByRole("button", { name: /^(Остаться|Отмена)$/ })).toBeFocused();
}

test("Клиентский кабинет: единственный выход в шапке, оформление остаётся в настройках; отмена и Escape не завершают сеанс", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await expect(exit(page)).toHaveCount(1);
    await expect(header(page).getByTestId("profile-cabinet-logout")).toHaveAttribute("aria-label", "Выйти из аккаунта");
    await expect(page.getByTestId("profile-cabinet-action-grid").getByTestId("profile-cabinet-logout")).toHaveCount(0);
    await expect(page.getByTestId("profile-cabinet-refresh")).toHaveCount(0);

    await page.getByTestId("profile-cabinet-action-appearance").click();
    const appearance = page.getByRole("dialog", { name: "Оформление", exact: true });
    await expect(appearance).toBeVisible();
    await appearance.getByRole("button", { name: "Закрыть оформление", exact: true }).click();
    await expect(appearance).toHaveCount(0);

    await openConfirmation(page);
    await confirmation(page).getByRole("button", { name: /^(Остаться|Отмена)$/ }).click();
    await expect(confirmation(page)).toHaveCount(0);
    await expect(exit(page)).toBeEnabled();
    await expect(exit(page)).toBeFocused();
    assert.equal((await state(page)).logoutCalls, 0);

    await openConfirmation(page);
    await page.keyboard.press("Escape");
    await expect(confirmation(page)).toHaveCount(0);
    await expect(exit(page)).toBeEnabled();
    await expect(exit(page)).toBeFocused();
    assert.deepEqual(await state(page), { logoutCalls: 0, refreshCalls: 0, results: [] });
  });
});

test("Клиентский выход: явное подтверждение вызывает callback один раз; false сохраняет кабинет и возможность повтора", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await openConfirmation(page);
    const confirm = confirmation(page).getByRole("button", { name: "Выйти", exact: true });
    await page.keyboard.press("Tab");
    await expect(confirm).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(confirmation(page).getByRole("button", { name: /^(Остаться|Отмена)$/ })).toBeFocused();
    await confirm.evaluate(button => { button.click(); button.click(); });
    await expect(confirmation(page)).toHaveCount(0);
    await expect.poll(async () => (await state(page)).logoutCalls).toBe(1);
    await expect(exit(page)).toBeDisabled();

    await page.evaluate(() => window.cabinetScene.settle(false));
    await expect(exit(page)).toBeEnabled();
    await expect(exit(page)).toBeFocused();
    await expect(page.getByText("Тестовый профиль", { exact: true })).toBeVisible();
    await expect(page.getByTestId("profile-cabinet-action-appearance")).toBeVisible();
    assert.deepEqual(await state(page), { logoutCalls: 1, refreshCalls: 0, results: [false] });

    await openConfirmation(page);
    await page.keyboard.press("Escape");
    await expect(exit(page)).toBeEnabled();
    assert.equal((await state(page)).logoutCalls, 1);
  });
});

test("Кабинет staff: обновление в шапке и прежний нижний выход не заменяются клиентским подтверждением", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await expect(header(page).getByTestId("profile-cabinet-logout")).toHaveCount(0);
    const refresh = header(page).getByRole("button", { name: "Обновить данные", exact: true });
    await refresh.click();
    assert.equal((await state(page)).refreshCalls, 1);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("profile-cabinet-action-appearance")).toHaveCount(0);

    const bottomExit = page.getByTestId("profile-cabinet-action-grid").getByTestId("profile-cabinet-logout");
    await expect(bottomExit).toHaveText("Выйти из аккаунта");
    await bottomExit.click();
    await expect.poll(async () => (await state(page)).logoutCalls).toBe(1);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.evaluate(() => window.cabinetScene.settle(false));
    await expect(refresh).toBeEnabled();
    await expect(bottomExit).toBeVisible();
  }, { staff: true });
});
