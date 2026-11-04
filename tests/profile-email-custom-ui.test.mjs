import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { build } from "vite";
import react from "@vitejs/plugin-react";

test("actual fully themed email form uses SDK login method and honest password guidance", { timeout: 60000 }, async () => {
  const path = name => JSON.stringify(fileURLToPath(new URL(`../src/${name}`, import.meta.url)).replaceAll("\\", "/"));
  const entry = "virtual:profile-email-custom-ui.jsx";
  const theme = ["styles/index.css", "styles/_variables.css", "shared/ui/ResponsiveModalLayer.module.css", "AppCoreFoundation.module.css", "AppCoreTheme.module.css", "AppCoreSurface.module.css", "AppCoreLayout.module.css", "AppCoreClientFlow.module.css", "AppCoreClientVisual.module.css", "AppCoreClientAppleTheme.css"];
  const result = await build({ configFile: false, logLevel: "silent", plugins: [{
    name: "profile-email-sdk-boundary", enforce: "pre",
    resolveId: id => id === entry ? `\0${entry}` : id === "firebase/auth" ? "\0email-auth-sdk" : null,
    load: id => id === "\0email-auth-sdk" ? "export const getIdTokenResult=async user=>({signInProvider:user.sdkProvider});"
      : id === `\0${entry}` ? `import React from 'react';import{createRoot}from'react-dom/client';import Email from ${path("features/client/profile/ProfileEmailModal.jsx")};import styles from ${path("AppCoreClientIosTheme.module.css")};import{useAppBackNavigation}from ${path("shared/hooks/useAppBackNavigation.js")};import{consumeModalBackLayer}from ${path("shared/hooks/modalBackNavigation.js")};${theme.map(name => `import ${path(name)};`).join("")}
      document.documentElement.classList.add(styles.contract);document.body.dataset.nativeAppUi='true';function Scene({provider}){useAppBackNavigation({isLoggedIn:true,appLoading:false,page:'cabinet',hasTransientScreen:true,handleTransientBack:()=>{window.parentBackCalls=(window.parentBackCalls||0)+1;return true},isPrimaryPage:()=>true});return <Email open authUser={{uid:'synthetic',sdkProvider:provider}} email='' onClose={()=>{window.closeCalls=(window.closeCalls||0)+1}} onReauthenticate={async()=>{window.logoutCalls=(window.logoutCalls||0)+1;if(window.reauthMode==='false')return false;if(window.reauthMode==='throw')throw new Error('synthetic logout failure');if(window.reauthMode==='pending')return window.pendingLogout;return true}} onRequestEmailChange={async(email,options)=>{window.emailRequest={email,...options};return true}}/>}const root=createRoot(document.getElementById('root'));window.showEmail=provider=>root.render(<Scene key={provider} provider={provider}/>);window.consumeEmailBack=consumeModalBackLayer;` : null
  }, react()], build: { write: false, cssCodeSplit: false, minify: false, rollupOptions: { input: entry, output: { format: "iife" } } } });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
    await page.route("**/*", route => route.abort());
    await page.setContent('<html data-app-theme="warm-light"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>');
    for (const output of result.output) {
      if (output.type === "asset" && output.fileName.endsWith(".css")) await page.addStyleTag({ content: String(output.source) });
      if (output.type === "chunk") await page.addScriptTag({ content: output.code });
    }
    await page.evaluate(() => window.showEmail("custom"));
    await expect(page.getByTestId("profile-email-submit")).toBeEnabled();
    await expect(page.getByTestId("profile-email-password")).toHaveCount(0);
    await expect(page.getByText(/текущая сессия Telegram не старше 5 минут/)).toBeVisible();
    await page.getByTestId("profile-email-address").fill("personal@example.test");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await mkdir(new URL("../artifacts/variant-a840", import.meta.url), { recursive: true });
    await page.screenshot({ path: fileURLToPath(new URL("../artifacts/variant-a840/email-custom-402.png", import.meta.url)) });
    await page.setViewportSize({ width: 320, height: 568 });
    await page.getByTestId("profile-email-submit").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("profile-email-submit")).toBeInViewport();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.clock.install();
    await page.getByTestId("profile-email-submit").click();
    await expect(page.getByTestId("profile-email-success")).toContainText("войди снова через Telegram в тот же аккаунт");
    assert.deepEqual(await page.evaluate(() => window.emailRequest), { email: "personal@example.test", currentPassword: "" });
    await expect(page.getByTestId("profile-email-form")).toHaveCount(0);
    await expect(page.getByTestId("profile-email-dismiss")).toHaveCount(0);
    await expect(page.getByTestId("profile-email-close")).toBeDisabled();
    await expect(page.getByTestId("profile-email-reauthenticate")).toBeFocused();
    await page.clock.fastForward(5000);
    await expect(page.getByTestId("profile-email-success")).toBeVisible();
    assert.deepEqual(await page.evaluate(() => [window.closeCalls || 0, window.logoutCalls || 0]), [0, 0]);
    await page.getByTestId("profile-email-overlay").click({ position: { x: 2, y: 2 } });
    assert.equal(await page.evaluate(() => window.closeCalls || 0), 0);
    for (const [width, height] of [[320, 568], [402, 874]]) {
      await page.setViewportSize({ width, height });
      await page.getByTestId("profile-email-reauthenticate").scrollIntoViewIfNeeded();
      await expect(page.getByTestId("profile-email-reauthenticate")).toBeInViewport();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: fileURLToPath(new URL(`../artifacts/variant-a840/email-success-${width}.png`, import.meta.url)) });
    }
    await page.getByTestId("profile-email-reauthenticate").click();
    assert.deepEqual(await page.evaluate(() => [window.closeCalls || 0, window.logoutCalls || 0]), [0, 1]);
    await page.evaluate(() => window.showEmail("password"));
    await expect(page.getByTestId("profile-email-password")).toBeVisible();
    await page.getByTestId("profile-email-address").fill("personal@example.test");
    await page.getByTestId("profile-email-password").fill("known-existing-password");
    await page.getByTestId("profile-email-submit").click();
    await expect(page.getByTestId("profile-email-success")).toContainText("новый email и существующий пароль");
    await page.getByTestId("profile-email-reauthenticate").click();
    assert.deepEqual(await page.evaluate(() => [window.closeCalls || 0, window.logoutCalls || 0]), [0, 2]);
    await page.keyboard.press("Escape");
    assert.deepEqual(await page.evaluate(() => [window.closeCalls || 0, window.logoutCalls || 0, window.parentBackCalls || 0]), [0, 3, 0]);
    assert.equal(await page.evaluate(() => window.consumeEmailBack()), true);
    assert.deepEqual(await page.evaluate(() => [window.closeCalls || 0, window.logoutCalls || 0, window.parentBackCalls || 0]), [0, 4, 0]);
    await expect(page.getByTestId("profile-email-reauthenticate")).toBeEnabled();
    await page.evaluate(() => { window.reauthMode = "false"; });
    await page.getByTestId("profile-email-reauthenticate").click();
    await expect(page.getByTestId("profile-email-reauthenticate-error")).toHaveText("Не удалось завершить выход. Попробуй ещё раз.");
    await expect(page.getByTestId("profile-email-reauthenticate")).toBeEnabled();
    await page.clock.fastForward(5000);
    assert.equal(await page.evaluate(() => window.logoutCalls), 5);
    await page.evaluate(() => { window.reauthMode = "pending"; window.pendingLogout = new Promise(resolve => { window.resolveLogout = resolve; }); });
    await page.getByTestId("profile-email-reauthenticate").click();
    await expect(page.getByTestId("profile-email-reauthenticate")).toBeDisabled();
    await expect(page.getByTestId("profile-email-reauthenticate")).toHaveText("Завершаю выход…");
    await page.evaluate(() => { window.consumeEmailBack(); window.consumeEmailBack(); });
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => window.logoutCalls), 6);
    await page.evaluate(() => window.resolveLogout(false));
    await expect(page.getByTestId("profile-email-reauthenticate-error")).toBeVisible();
    await expect(page.getByTestId("profile-email-reauthenticate")).toBeEnabled();
    await page.evaluate(() => { window.reauthMode = "throw"; });
    await page.getByTestId("profile-email-reauthenticate").click();
    await expect(page.getByTestId("profile-email-reauthenticate-error")).toBeVisible();
    assert.equal(await page.evaluate(() => window.logoutCalls), 7);
    await page.evaluate(() => { window.reauthMode = "success"; });
    await page.getByTestId("profile-email-reauthenticate").click();
    await expect(page.getByTestId("profile-email-reauthenticate-error")).toHaveCount(0);
    assert.deepEqual(await page.evaluate(() => [window.closeCalls || 0, window.logoutCalls || 0, window.parentBackCalls || 0]), [0, 8, 0]);
  } finally { await browser.close(); }
});
