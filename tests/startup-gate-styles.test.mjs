import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { build } from "vite";
import react from "@vitejs/plugin-react";

test("production CSS Modules retain actual pending/role gates and style their real DOM", { timeout: 60000 }, async () => {
  const gate = fileURLToPath(new URL("../src/app/appStartupGate.jsx", import.meta.url)).replaceAll("\\", "/");
  const entry = "virtual:startup-gate-style-test";
  const result = await build({
    configFile: false, logLevel: "silent",
    plugins: [react(), {
      name: "startup-gate-style-test",
      resolveId: id => id === entry ? `\0${entry}` : null,
      load: id => id === `\0${entry}` ? `import React from 'react';import {createRoot} from 'react-dom/client';import {AppStartupGate} from ${JSON.stringify(gate)};
        const root=createRoot(document.getElementById('root'));window.renderGate=props=>root.render(React.createElement(AppStartupGate,{isLoggedIn:true,logout:()=>{window.didLogout=true},...props}));` : null
    }],
    build: { write: false, cssCodeSplit: false, minify: false, rollupOptions: { input: entry, output: { format: "iife" } } }
  });
  const output = result.output;
  const css = output.filter(item => item.type === "asset" && item.fileName.endsWith(".css")).map(item => String(item.source)).join("\n");
  const js = output.filter(item => item.type === "chunk").map(item => item.code).join("\n");
  // Guards the emitted deployable artifact, not just a source-selector string.
  assert.match(css, /pendingAccessGate/);
  assert.match(css, /roleAccessGateCard/);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
    await page.route("**/*", route => route.abort());
    await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style></head><body><div id="root"></div></body></html>');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: js });
    const actionGradient = await page.evaluate(() => {
      const probe = document.createElement("span");
      probe.style.backgroundImage = "var(--ownset-action-gradient, linear-gradient(115deg, #467b72 0%, #3e748b 54%, #3565a3 100%))";
      document.body.append(probe);
      const gradient = getComputedStyle(probe).backgroundImage;
      probe.remove();
      return gradient;
    });
    assert.match(actionGradient, /^linear-gradient\(/);
    await page.evaluate(() => window.renderGate({ currentUserRole: "pending-client" }));
    await page.getByRole("heading", { name: "Ждём назначения тренера" }).waitFor();
    const pending = await page.locator("main").evaluate(node => {
      const card = node.querySelector("section"), button = node.querySelector("button");
      return { display: getComputedStyle(node).display, background: getComputedStyle(node).backgroundColor,
        radius: getComputedStyle(card).borderRadius, minHeight: getComputedStyle(button).minHeight,
        buttonBackground: getComputedStyle(button).backgroundImage, width: document.documentElement.scrollWidth };
    });
    assert.deepEqual(pending, { display: "grid", background: "rgb(242, 242, 247)", radius: "28px", minHeight: "50px", buttonBackground: actionGradient, width: 402 });
    await page.getByRole("button", { name: "Выйти", exact: true }).click();
    assert.equal(await page.evaluate(() => window.didLogout), true);
    await page.evaluate(() => {
      window.Telegram = { WebApp: { initData: "synthetic-init-data" } };
      window.renderGate({ currentUserRole: "pending-client", handleTelegramMiniAppAuth: () => { window.invitationChecks = (window.invitationChecks || 0) + 1; } });
    });
    const checkInvite = page.getByRole("button", { name: "Проверить приглашение", exact: true });
    await checkInvite.click();
    assert.equal(await page.evaluate(() => window.invitationChecks), 1);
    for (const [width, height] of [[402, 874], [320, 720], [844, 390]]) {
      await page.setViewportSize({ width, height });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.ok((await checkInvite.boundingBox()).height >= 44);
    }
    await page.evaluate(() => window.renderGate({ currentUserRole: "pending-client", loginSubmitting: true,
      loginError: "Приглашение удалено", loginNotice: "Попросите новую ссылку", handleTelegramMiniAppAuth() {} }));
    assert.equal(await page.getByRole("button", { name: "Проверяем приглашение…", exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole("alert").innerText(), "Приглашение удалено");
    assert.equal(await page.getByText("Попросите новую ссылку", { exact: true }).isVisible(), true);
    await page.evaluate(() => window.renderGate({ currentUserRole: "unresolved", roleAccessGateState: "unresolved" }));
    await page.getByRole("heading", { name: "Не удалось подтвердить роль аккаунта" }).waitFor();
    const unresolved = await page.locator("main").evaluate(node => ({
      display: getComputedStyle(node).display, radius: getComputedStyle(node.querySelector("section")).borderRadius,
      buttonHeight: getComputedStyle(node.querySelector("button")).minHeight,
      primary: getComputedStyle(node.querySelector("button")).backgroundImage
    }));
    assert.deepEqual(unresolved, { display: "grid", radius: "28px", buttonHeight: "48px", primary: actionGradient });
  } finally { await browser.close(); }
});
