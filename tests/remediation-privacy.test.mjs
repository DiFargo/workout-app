import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { chromium, expect } from "@playwright/test";
import postcss from "postcss";

const notice = await readFile(new URL("../public/privacy.html", import.meta.url), "utf8");
const source = name => JSON.stringify(fileURLToPath(new URL(`../src/${name}`, import.meta.url)).replaceAll("\\", "/"));
const bundle = await rolldown({
  input: "privacy-test-entry", platform: "browser", transform: { jsx: { runtime: "automatic" } },
  plugins: [{
    name: "privacy-test", resolveId: id => id === "privacy-test-entry" ? id : null,
    load(id) {
      if (id.endsWith(".css")) return { code: "export default {};", moduleType: "js" };
      if (id !== "privacy-test-entry") return null;
      return { moduleType: "jsx", code: `import React from 'react';import {createRoot} from 'react-dom/client';
        import {LoginPage} from ${source("components/auth/AuthScreens.jsx")};
        import Account from ${source("features/client/profile/ProfileAccountSettingsSection.jsx")};
        const root=createRoot(document.getElementById('root'));const noop=()=>{};
        window.showPrivacySurface=surface=>root.render(surface==='login'?<LoginPage login='' password='' loginError='' loginFieldErrors={{}} setLogin={noop} setPassword={noop} setLoginError={noop} setLoginNotice={noop} setLoginFieldErrors={noop} handleEmailSignup={noop}/>:<Account draft={{displayName:'Client',login:'client'}} onDraftChange={noop} onSave={noop}/>);` };
    }
  }]
});
const generated = await bundle.generate({ format: "iife" });
await bundle.close();

test("privacy notice has parseable neutral CSS and no automatic request/deletion surface", async () => {
  postcss.parse(notice.match(/<style>([\s\S]*?)<\/style>/)[1]);
  for (const name of ["components/auth/AuthScreens.module.css", "components/auth/CompactAuth.module.css", "features/client/profile/ProfileAccountSettingsSection.module.css"]) {
    postcss.parse(await readFile(new URL(`../src/${name}`, import.meta.url), "utf8"));
  }
  assert.doesNotMatch(notice, /<script\b|<form\b|mailto:|https?:\/\//i);
  for (const text of ["OpenAI", "Google Gemini", "Telegram", "локальные черновики", "текущего назначенного тренера", "резервное копирование включено", "срок хранения", "администратору"]) assert.ok(notice.includes(text), text);
});

test("notice is readable on small/mobile widths and privacy links precede registration", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    let externalRequests = 0;
    await page.route("**/*", route => { externalRequests += 1; return route.abort(); });
    for (const width of [320, 402]) {
      await page.setViewportSize({ width, height: 874 });
      await page.setContent(notice);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Данные и конфиденциальность");
      assert.equal(await page.locator("html").getAttribute("lang"), "ru");
      const metrics = await page.evaluate(() => ({
        width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
        font: parseFloat(getComputedStyle(document.body).fontSize), line: parseFloat(getComputedStyle(document.body).lineHeight),
        links: [...document.querySelectorAll('nav a')].map(link => ({ height: link.getBoundingClientRect().height, target: !!document.getElementById(link.hash.slice(1)) }))
      }));
      assert.ok(metrics.scroll <= metrics.width);
      assert.ok(metrics.font >= 16 && metrics.line >= metrics.font * 1.5);
      assert.ok(metrics.links.every(link => link.height >= 44 && link.target));
      await page.keyboard.press("Tab");
      assert.ok(await page.locator("nav a").first().evaluate(link => link === document.activeElement && getComputedStyle(link).outlineStyle !== "none"));
      await page.getByRole("link", { name: "Копия или удаление", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Как запросить копию или удаление" })).toBeInViewport();
    }
    assert.equal(externalRequests, 0, "notice must not upload data or contact third parties");

    await page.setContent('<main id="root"></main>');
    await page.addScriptTag({ content: generated.output[0].code });
    await page.evaluate(() => window.showPrivacySurface("login"));
    const privacyLink = page.getByRole("link", { name: "Данные и конфиденциальность", exact: true });
    await expect(privacyLink).toHaveAttribute("href", "/privacy.html");
    await expect(privacyLink).toHaveAttribute("target", "_blank");
    await expect(privacyLink).toHaveAttribute("rel", "noopener noreferrer");
    await expect(privacyLink).toBeVisible();
    await page.getByRole("button", { name: "Создать аккаунт", exact: true }).click();
    await expect(privacyLink).toBeVisible();
    assert.ok(await privacyLink.evaluate(link => Boolean(link.compareDocumentPosition(document.querySelector('button[type="submit"]')) & Node.DOCUMENT_POSITION_FOLLOWING)));
    await page.evaluate(() => window.showPrivacySurface("account"));
    await expect(privacyLink).toBeVisible();
    await expect(privacyLink).toHaveAttribute("href", "/privacy.html");
    await expect(privacyLink).toHaveAttribute("rel", "noopener noreferrer");
  } finally { await browser.close(); }
});
