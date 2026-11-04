import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";
import { rolldown } from "rolldown";
import { transform } from "lightningcss";
import { chromium, expect } from "@playwright/test";
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions,
  verifyAuthenticationResponse } from "../functions/node_modules/@simplewebauthn/server/esm/index.js";

const ORIGIN = "https://security-key.fixture.invalid";
const RP_ID = "security-key.fixture.invalid";
const BASE = Date.now();
const source = name => fileURLToPath(new URL(`../src/${name}`, import.meta.url)).replaceAll("\\", "/");
const css = [];
const bundle = await rolldown({ input: "admin-key-scene", platform: "browser", transform: { jsx: { runtime: "automatic" } }, plugins: [{
  name: "actual-admin-security-key-ui-isolated-transport",
  resolveId(id) {
    if (id === "admin-key-scene") return id;
    if (id === "firebase/auth") return "key-auth";
    if (/(?:^|\/)apiClient(?:\.js)?$/.test(id)) return "key-http";
    return null;
  },
  async load(id) {
    if (id.endsWith(".css")) {
      const sheet = transform({ filename: id, code: await readFile(id), cssModules: true, errorRecovery: false });
      css.push(sheet.code.toString());
      return { moduleType: "js", code: `export default ${JSON.stringify(Object.fromEntries(Object.entries(sheet.exports).map(([key, value]) => [key, value.name])))};` };
    }
    if (id === "key-auth") return `
      const state=window.keyAudit={calls:[],exchanges:[],mounts:0,unmounts:0,prompts:0,logout:0,statusMode:'success',
        status:{required:false,keys:[],verifiedUntil:null},...window.keyInitial};
      export const auth={currentUser:{uid:'admin-fixture'}};window.keyAuth=auth;
      const listeners=new Set();export function emitAuth(){for(const callback of listeners)callback(auth.currentUser);}
      export function onIdTokenChanged(_,callback){listeners.add(callback);queueMicrotask(()=>listeners.has(callback)&&callback(auth.currentUser));return()=>listeners.delete(callback);}
      export async function signInWithCustomToken(_,token){state.exchanges.push(token);if(state.exchangeError)throw new Error('synthetic exchange failure');
        auth.currentUser={uid:'admin-fixture'};state.status=state.pendingStatus;emitAuth();return{user:auth.currentUser};}
      state.emitAuth=emitAuth;
    `;
    if (id === "key-http") return `
      export async function fetchAuthorizedWithTimeout(url,options){
        const state=window.keyAudit,body=JSON.parse(options.body);state.calls.push({url,...body});
        if(body.action==='status'){
          const mode=state.statusMode;
          if(mode==='hold')await new Promise(resolve=>{state.releaseStatus=resolve});
          if(mode==='error')return{ok:false,json:async()=>({error:'unavailable',message:'Не удалось проверить защиту. Повторите попытку.'})};
          return{ok:true,json:async()=>structuredClone(state.status)};
        }
        if(body.action.endsWith('-verify')&&state.verifyError)return{ok:false,json:async()=>({error:'verification-failed',message:'Не удалось проверить ключ. Начните подтверждение заново.'})};
        const result=await window.keyVirtualTransport(body);
        if(result.pendingStatus)state.pendingStatus=result.pendingStatus;
        return{ok:result.status===200,json:async()=>result.data};
      }
    `;
    if (id !== "admin-key-scene") return null;
    return { moduleType: "jsx", code: `
      import React,{useContext,useEffect}from'react';import{createRoot}from'react-dom/client';
      import Boundary from ${JSON.stringify(source("components/admin/AdminSecurityKeyBoundary.jsx"))};
      import{AdminSecurityKeyContext}from ${JSON.stringify(source("components/admin/AdminSecurityKeyContext.js"))};
      import{useModalFocusTrap}from ${JSON.stringify(source("shared/hooks/useModalFocusTrap.js"))};
      import{useAppBackNavigation}from ${JSON.stringify(source("shared/hooks/useAppBackNavigation.js"))};
      import{getModalBackLayerCount}from ${JSON.stringify(source("shared/hooks/modalBackNavigation.js"))};
      import{WebAuthnAbortService}from'@simplewebauthn/browser';import{auth}from'firebase/auth';
      function Children(){const open=useContext(AdminSecurityKeyContext);useEffect(()=>{window.keyAudit.mounts++;return()=>{window.keyAudit.unmounts++}},[]);
        return<section data-testid='protected-admin'><h1>Синтетические данные администратора</h1><button onClick={open}>Управлять ключами</button></section>;}
      function Scene(){useModalFocusTrap();useAppBackNavigation({isLoggedIn:true,appLoading:false,page:'main',isPrimaryPage:()=>true});
        return<Boundary auth={auth} onLogout={()=>{window.keyAudit.logout++}}><Children/></Boundary>;}
      window.keyAudit.cancel=()=>WebAuthnAbortService.cancelCeremony();
      window.keyAudit.backLayers=getModalBackLayerCount;
      const nativeGet=navigator.credentials.get.bind(navigator.credentials);
      navigator.credentials.get=options=>{window.keyAudit.prompts++;return nativeGet(options)};
      createRoot(document.getElementById('root')).render(<Scene/>);
    ` };
  }
}] });
const generated = await bundle.generate({ format: "iife", codeSplitting: false });
await bundle.close();
const code = generated.output.find(item => item.type === "chunk").code;
const protectedAdmin = page => page.getByTestId("protected-admin");
const manager = page => page.getByRole("dialog", { name: "USB/NFC-ключи", exact: true });

function virtualTransport() {
  const challenges = new Map(), credentials = new Map(), verifications = [];
  const keys = () => [...credentials.values()].map(key => ({ id: createHash("sha256").update(key.credential.id).digest("hex"), label: key.label, createdAt: BASE }));
  return { verifications, async request(body) {
    const purpose = body.action.startsWith("registration") ? "registration" : "authentication";
    if (body.action.endsWith("-options")) {
      const options = purpose === "registration" ? await generateRegistrationOptions({ rpID: RP_ID, rpName: "Isolated fixture",
        userID: new Uint8Array([1, 2, 3]), userName: "admin-fixture", attestationType: "none", supportedAlgorithmIDs: [-7],
        preferredAuthenticatorType: "securityKey", authenticatorSelection: {
          authenticatorAttachment: "cross-platform", residentKey: "discouraged", userVerification: "required" },
        excludeCredentials: [...credentials.values()].map(key => ({ id: key.credential.id, transports: ["usb"] })) })
        : await generateAuthenticationOptions({ rpID: RP_ID, userVerification: "required",
          allowCredentials: [...credentials.values()].map(key => ({ id: key.credential.id, transports: ["usb"] })) });
      const challengeId = randomBytes(32).toString("base64url"); challenges.set(challengeId, { purpose, value: options.challenge });
      return { status: 200, data: { challengeId, options } };
    }
    const challenge = challenges.get(body.challengeId); assert.equal(challenge?.purpose, purpose);
    challenges.delete(body.challengeId);
    if (purpose === "registration") {
      // Match the real server's optional-label contract, not a permissive UI-only mock.
      if (Object.hasOwn(body, "label") && !body.label.trim()) return { status: 400, data: { error: "invalid-label", message: "Пустое название" } };
      const verified = await verifyRegistrationResponse({ response: body.response, expectedChallenge: challenge.value,
        expectedOrigin: ORIGIN, expectedRPID: RP_ID, supportedAlgorithmIDs: [-7], requireUserVerification: true });
      assert.equal(verified.verified, true); assert.equal(verified.registrationInfo.userVerified, true);
      assert.equal(verified.registrationInfo.credentialDeviceType, "singleDevice"); assert.equal(verified.registrationInfo.credentialBackedUp, false);
      credentials.set(body.response.id, { credential: verified.registrationInfo.credential, label: body.label || "Ключ безопасности" });
    } else {
      const key = credentials.get(body.response.id); assert.ok(key);
      const verified = await verifyAuthenticationResponse({ response: body.response, credential: key.credential,
        expectedChallenge: challenge.value, expectedOrigin: ORIGIN, expectedRPID: RP_ID, requireUserVerification: true });
      assert.equal(verified.verified, true); assert.equal(verified.authenticationInfo.userVerified, true);
      key.credential.counter = verified.authenticationInfo.newCounter;
    }
    verifications.push(purpose);
    const verifiedUntil = Date.now() + 8 * 3600000;
    return { status: 200, data: { customToken: "isolated-key-proof-token", verifiedUntil },
      pendingStatus: { required: true, keys: keys(), verifiedUntil } };
  } };
}

async function fixture(initial, run) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
    page.setDefaultTimeout(5000);
    const errors = [], unexpectedRequests = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => {
      if (route.request().url() === `${ORIGIN}/isolated-ui`) return route.fulfill({ status: 200, contentType: "text/html",
        body: '<meta name="viewport" content="width=device-width,initial-scale=1"><main id="root"></main>' });
      unexpectedRequests.push(route.request().url()); return route.abort();
    });
    const transport = virtualTransport();
    await page.exposeFunction("keyVirtualTransport", body => transport.request(body));
    await page.clock.install({ time: new Date(BASE) });
    await page.goto(`${ORIGIN}/isolated-ui`);
    await page.addStyleTag({ content: `:root{--ownset-action-gradient:linear-gradient(115deg,#467b72 0%,#3e748b 54%,#3565a3 100%)}body{margin:0;background:#f2f2f7;font-family:Arial,sans-serif}${css.join("\n")}` });
    await page.evaluate(value => { window.keyInitial = value; }, initial);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("WebAuthn.enable");
    const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", transport: "usb",
      hasResidentKey: false, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
    await page.addScriptTag({ content: code });
    await expect.poll(() => page.evaluate(() => window.keyAudit?.calls.length || 0)).toBeGreaterThan(0);
    await run({ page, cdp, authenticatorId, transport });
    assert.deepEqual(errors, []); assert.deepEqual(unexpectedRequests, []);
  } finally { await browser.close(); }
}

test("ключи: status loading/error не монтирует админские данные; retry возвращает проверенный доступ", { timeout: 30000 }, async () => {
  await fixture({ statusMode: "hold" }, async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Проверяем защиту входа" })).toBeVisible();
    await expect(protectedAdmin(page)).toHaveCount(0);
    assert.equal(await page.evaluate(() => window.keyAudit.mounts), 0);
    await page.evaluate(() => { window.keyAudit.statusMode = "error"; window.keyAudit.releaseStatus(); window.keyAudit.emitAuth(); });
    await expect(page.getByRole("alert")).toContainText("Не удалось проверить защиту");
    await expect(protectedAdmin(page)).toHaveCount(0);
    await page.evaluate(() => { window.keyAudit.statusMode = "success"; });
    await page.getByRole("button", { name: "Повторить проверку", exact: true }).click();
    await expect(protectedAdmin(page)).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    assert.equal(await page.evaluate(() => window.keyAudit.exchanges.length), 0);
  });
});

test("ключи: required/unverified gate, подтверждённый status и token revalidation fail closed", { timeout: 30000 }, async () => {
  await fixture({ status: { required: true, keys: [], verifiedUntil: null } }, async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Подтвердите вход ключом" })).toBeVisible();
    await expect(protectedAdmin(page)).toHaveCount(0);
    await page.evaluate(base => { window.keyAudit.status.verifiedUntil = base + 3600000; window.keyAudit.emitAuth(); }, BASE);
    await expect(protectedAdmin(page)).toBeVisible();
    await page.evaluate(() => { window.keyAudit.statusMode = "hold"; window.keyAudit.emitAuth(); });
    await expect(page.getByRole("heading", { name: "Проверяем защиту входа" })).toBeVisible();
    await expect(protectedAdmin(page)).toHaveCount(0);
    assert.equal(await page.evaluate(() => window.keyAudit.unmounts), 1);
    await page.evaluate(() => { window.keyAudit.status.verifiedUntil = null; window.keyAudit.releaseStatus(); });
    await expect(page.getByRole("heading", { name: "Подтвердите вход ключом" })).toBeVisible();
    assert.equal(await page.evaluate(() => window.keyAudit.mounts), 1);
  });
});

test("ключи: Context manager сохраняет header/footer и действия на 320×600, 402×874, 1440×900", { timeout: 30000 }, async () => {
  const keys = Array.from({ length: 5 }, (_, index) => ({ id: `hash-${index}`, label: `Резервный USB-ключ ${index + 1} с длинным названием`, createdAt: BASE }));
  await fixture({ status: { required: true, keys, verifiedUntil: BASE + 3600000 } }, async ({ page }) => {
    await expect(protectedAdmin(page)).toBeVisible();
    await page.getByRole("button", { name: "Управлять ключами", exact: true }).click();
    for (const viewport of [{ width: 320, height: 600 }, { width: 402, height: 874 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await expect(manager(page)).toBeVisible();
      const before = await manager(page).evaluate(dialog => {
        const header = dialog.querySelector("header").getBoundingClientRect(), footer = dialog.querySelector("footer").getBoundingClientRect();
        const body = dialog.querySelector("header").nextElementSibling;
        return { headerTop: header.top, footerBottom: footer.bottom, bodyScroll: body.scrollHeight > body.clientHeight,
          overflow: document.documentElement.scrollWidth > innerWidth, buttonRects: [...dialog.querySelectorAll("footer button")].map(button => {
            const rect = button.getBoundingClientRect(); return { top: rect.top, bottom: rect.bottom, height: rect.height, left: rect.left, right: rect.right };
          }) };
      });
      assert.ok(before.headerTop >= 0); assert.ok(before.footerBottom <= viewport.height); assert.equal(before.overflow, false);
      const list = await manager(page).getByRole("list").evaluate(node => ({ height: node.clientHeight, scrollHeight: node.scrollHeight }));
      assert.ok(list.height > 0 && list.scrollHeight <= list.height + 1, `Все ключи должны быть в scroll-body, а не обрезаны внутри ul: ${JSON.stringify(list)}`);
      for (const rect of before.buttonRects) { assert.ok(rect.top >= 0 && rect.bottom <= viewport.height); assert.ok(rect.height >= 44); assert.ok(rect.left >= 0 && rect.right <= viewport.width); }
      if (viewport.width === 320) assert.equal(before.bodyScroll, true);
      if (viewport.width === 320) {
        await mkdir("output/playwright", { recursive: true });
        await page.screenshot({ path: "output/playwright/admin-security-key-manager-320x600.png" });
      }
      await manager(page).evaluate(dialog => { const body = dialog.querySelector("header").nextElementSibling; body.scrollTop = body.scrollHeight; });
      assert.equal(await manager(page).locator("footer").evaluate(footer => footer.getBoundingClientRect().bottom), before.footerBottom);
      await expect(manager(page).getByRole("button", { name: "Добавить резервный ключ", exact: true })).toBeDisabled();
      assert.match(await manager(page).getByRole("button", { name: "Добавить резервный ключ", exact: true }).evaluate(button => getComputedStyle(button).backgroundImage), /linear-gradient/);
    }
    await manager(page).getByRole("button", { name: "Закрыть", exact: true }).click();
    await expect(manager(page)).toHaveCount(0); await expect(protectedAdmin(page)).toBeVisible();
    assert.equal(await page.evaluate(() => window.keyAudit.backLayers()), 0);
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
    assert.equal(await page.evaluate(() => window.keyAudit.exchanges.length), 0);
  });
});

test("ключи: настоящий browser FIDO2 registration + authentication проходят только через verified HTTP ACK и Firebase exchange", { timeout: 30000 }, async () => {
  await fixture({}, async ({ page, transport }) => {
    await expect(protectedAdmin(page)).toBeVisible();
    await page.getByRole("button", { name: "Управлять ключами", exact: true }).click();
    await manager(page).getByRole("button", { name: "Добавить ключ и включить", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.keyAudit.exchanges.length)).toBe(1);
    await expect(manager(page)).toContainText("Вход защищён ключом");
    await expect(manager(page)).toContainText("Ключ безопасности");
    const registration = await page.evaluate(() => window.keyAudit.calls.find(call => call.action === "registration-verify"));
    assert.equal(Object.hasOwn(registration, "label"), false);
    assert.equal(registration.response.authenticatorAttachment, "cross-platform");
    await manager(page).getByRole("button", { name: "Закрыть", exact: true }).click();
    await page.evaluate(() => { window.keyAudit.status.verifiedUntil = null; window.keyAudit.emitAuth(); });
    await expect(protectedAdmin(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Подтвердить ключом", exact: true }).click();
    await expect(protectedAdmin(page)).toBeVisible();
    assert.deepEqual(transport.verifications, ["registration", "authentication"]);
    assert.equal(await page.evaluate(() => window.keyAudit.exchanges.length), 2);
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), []);
  });
});

test("ключи: отмена настоящего WebAuthn prompt оставляет gate закрытым и не отправляет verify/exchange", { timeout: 30000 }, async () => {
  await fixture({}, async ({ page, cdp, authenticatorId }) => {
    await expect(protectedAdmin(page)).toBeVisible();
    await page.getByRole("button", { name: "Управлять ключами", exact: true }).click();
    await manager(page).getByRole("button", { name: "Добавить ключ и включить", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.keyAudit.exchanges.length)).toBe(1);
    await manager(page).getByRole("button", { name: "Закрыть", exact: true }).click();
    await page.evaluate(() => { window.keyAudit.status.verifiedUntil = null; window.keyAudit.emitAuth(); });
    await expect(page.getByRole("heading", { name: "Подтвердите вход ключом" })).toBeVisible();
    await cdp.send("WebAuthn.setAutomaticPresenceSimulation", { authenticatorId, enabled: false });
    await page.getByRole("button", { name: "Подтвердить ключом", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.keyAudit.prompts)).toBe(1);
    await expect(page.getByRole("button", { name: "Ожидаем ключ…", exact: true })).toBeDisabled();
    await page.evaluate(() => window.keyAudit.cancel());
    await expect(page.getByRole("alert")).toContainText("Подтверждение отменено");
    await expect(protectedAdmin(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Подтвердить ключом", exact: true })).toBeEnabled();
    assert.equal(await page.evaluate(() => window.keyAudit.exchanges.length), 1);
    assert.equal(await page.evaluate(() => window.keyAudit.calls.filter(call => call.action === "authentication-verify").length), 0);
  });
});

test("ключи: expiry timer снимает уже смонтированные админские children", { timeout: 30000 }, async () => {
  await fixture({ status: { required: true, keys: [], verifiedUntil: BASE + 2000 } }, async ({ page }) => {
    await expect(protectedAdmin(page)).toBeVisible();
    assert.equal(await page.evaluate(() => window.keyAudit.mounts), 1);
    await page.clock.fastForward(2100);
    await expect(page.getByRole("heading", { name: "Подтвердите вход ключом" })).toBeVisible();
    await expect(protectedAdmin(page)).toHaveCount(0);
    assert.equal(await page.evaluate(() => window.keyAudit.unmounts), 1);
    assert.equal(await page.evaluate(() => window.keyAudit.exchanges.length), 0);
  });
});

test("ключи: expiry при открытом manager не оставляет невидимый scroll/back lock", { timeout: 30000 }, async () => {
  await fixture({ status: { required: true, keys: [], verifiedUntil: BASE + 2000 } }, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 600 });
    await expect(protectedAdmin(page)).toBeVisible();
    await page.getByRole("button", { name: "Управлять ключами", exact: true }).click();
    await expect(manager(page)).toBeVisible();
    await page.clock.fastForward(2100);
    await expect(page.getByRole("heading", { name: "Подтвердите вход ключом" })).toBeVisible();
    await expect(protectedAdmin(page)).toHaveCount(0); await expect(manager(page)).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.keyAudit.backLayers())).toBe(0);
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  });
});

test("ключи: отказ verify ACK не обменивает token и не открывает children; новый challenge позволяет повтор", { timeout: 30000 }, async () => {
  await fixture({}, async ({ page, transport }) => {
    await expect(protectedAdmin(page)).toBeVisible();
    await page.getByRole("button", { name: "Управлять ключами", exact: true }).click();
    await manager(page).getByRole("button", { name: "Добавить ключ и включить", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.keyAudit.exchanges.length)).toBe(1);
    await manager(page).getByRole("button", { name: "Закрыть", exact: true }).click();
    await page.evaluate(() => { window.keyAudit.status.verifiedUntil = null; window.keyAudit.verifyError = true; window.keyAudit.emitAuth(); });
    await expect(page.getByRole("heading", { name: "Подтвердите вход ключом" })).toBeVisible();
    await page.getByRole("button", { name: "Подтвердить ключом", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Не удалось проверить ключ");
    await expect(protectedAdmin(page)).toHaveCount(0);
    assert.equal(await page.evaluate(() => window.keyAudit.exchanges.length), 1);
    await page.evaluate(() => { window.keyAudit.verifyError = false; });
    await page.getByRole("button", { name: "Подтвердить ключом", exact: true }).click();
    await expect(protectedAdmin(page)).toBeVisible();
    assert.equal(await page.evaluate(() => window.keyAudit.exchanges.length), 2);
    assert.deepEqual(transport.verifications, ["registration", "authentication"]);
    assert.equal(await page.evaluate(() => window.keyAudit.calls.filter(call => call.action === "authentication-options").length), 2);
  });
});
