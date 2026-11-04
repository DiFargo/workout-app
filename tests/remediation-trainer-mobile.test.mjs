import assert from "node:assert/strict";
import test from "node:test";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { transform } from "lightningcss";
import { chromium, expect } from "@playwright/test";

const source = path => JSON.stringify(fileURLToPath(new URL(`../src/${path}`, import.meta.url)).replaceAll("\\", "/"));
const css = new Map();
const io = `const denied=()=>{throw new Error('Unexpected I/O in isolated subscription preview')};
export const auth={currentUser:null},db={},storage={},app={options:{storageBucket:'synthetic.invalid'}},functions={};
export const collection=denied,doc=denied,getDoc=denied,getDocs=denied,setDoc=denied,addDoc=denied,updateDoc=denied,deleteDoc=denied,query=denied,where=denied,orderBy=denied,limit=denied,startAfter=denied,documentId=denied,writeBatch=denied,runTransaction=denied,serverTimestamp=denied,onSnapshot=denied;
export const onAuthStateChanged=()=>()=>{};
export const fetchAuthorized=denied,fetchAuthorizedWithTimeout=denied,fetchAuthorizedJson=denied,ref=denied,uploadBytes=denied,getDownloadURL=denied,deleteObject=denied,getMetadata=denied,getStorage=denied,uploadBytesResumable=denied;`;
const bundle = await rolldown({
  input: "remediation-trainer-mobile-entry", platform: "browser", transform: { jsx: { runtime: "automatic" }, define: { "import.meta.env": "{}" } },
  plugins: [{
    name: "isolated-subscription-ui",
    resolveId(id) {
      if (id === "remediation-trainer-mobile-entry") return id;
      if (/^firebase\//.test(id) || /(?:^|\/)firebase(?:\.js)?$/.test(id) || /(?:^|\/)apiClient(?:\.js)?$/.test(id)) return "remediation-ui-io";
      return null;
    },
    async load(id) {
      if (id === "remediation-ui-io") return io;
      if (id.endsWith(".css")) {
        const contents = await readFile(id);
        const result = transform({ filename: id, code: contents, cssModules: id.endsWith(".module.css"), minify: false });
        css.set(id, result.code.toString());
        return { moduleType: "js", code: `export default ${JSON.stringify(Object.fromEntries(Object.entries(result.exports || {}).map(([key, value]) => [key, value.name])))};` };
      }
      if (id !== "remediation-trainer-mobile-entry") return null;
      return { moduleType: "jsx", code: `import React from 'react';import{createRoot}from'react-dom/client';
        import{ClientSubscriptionCard}from ${source("components/trainer/TrainerWorkspace.jsx")};
        import base from ${source("components/trainer/TrainerWorkspace.module.css")};
        import calm from ${source("components/trainer/TrainerWorkspaceCalm.module.css")};
        import responsive from ${source("components/trainer/TrainerWorkspaceResponsivePass.module.css")};
        import modal from ${source("components/trainer/TrainerWorkspaceModalSystem.module.css")};
        import adaptive from ${source("components/trainer/TrainerWorkspaceAdaptive.module.css")};
        import ${source("components/trainer/TrainerWorkspaceV2.module.css")};
        const root=createRoot(document.getElementById('root'));let key=0;
        window.show=(kind,inline=true)=>{window.saved=null;const subscription=kind==='new'?{}:{periodMode:'sessions',cycleId:'synthetic-cycle',purchasedSessions:12,usedSessions:2,...(kind==='frozen'?{frozen:true,frozenUntil:'2099-01-01'}:{})};
        root.render(<div className={base.workspaceRoot}><div className={['trainerNextRoot',calm.workspaceRoot,responsive.scope,modal.scope,adaptive.root].join(' ')}><div className='trainerNextClientPage'><ClientSubscriptionCard key={++key} client={{id:'synthetic-client',name:'Тестовый клиент',subscription}} inline={inline} open={!inline} onSave={async settings=>{window.saved=settings;return true}}/></div></div></div>)};` };
    }
  }]
});
const generated = await bundle.generate({ format: "iife" }); await bundle.close();
const rootCss = (await Promise.all(["styles/_variables.css", "styles/_reset.css", "styles/index.css", "AppCoreFoundation.module.css", "AppCoreTheme.module.css", "AppCoreSurface.module.css", "AppCoreLayout.module.css", "AppCoreClientAppleTheme.css"].map(async path => (await readFile(new URL(`../src/${path}`, import.meta.url), "utf8")).replace(/@import[^;]+;/g, "")))).join("\n");

test("actual subscription UI has a default-off conditional 44px resume target at 402 and 320px", { timeout: 60000 }, async () => {
  const output = fileURLToPath(new URL("../artifacts/remediation-3.0.850/", import.meta.url)); await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const width of [402, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 874 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      const errors = []; page.on("pageerror", error => errors.push(error.message));
      await page.setContent('<!doctype html><html lang="ru" data-trainer-variant="v2"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body data-trainer-variant="v2" data-native-app-ui="true"><main id="root"></main></body></html>');
      await page.addStyleTag({ content: rootCss + "\n" + [...css.values()].join("\n") });
      await page.addScriptTag({ content: generated.output.find(item => item.type === "chunk" && item.isEntry).code });
      assert.deepEqual(errors, [], "subscription component bundle must initialize without runtime errors");
      for (const kind of ["new", "active", "frozen"]) {
        await page.evaluate(kind => window.show(kind), kind);
        const region = page.getByRole("region", { name: "Настройка абонемента клиента" }); await expect(region).toBeVisible();
        const checkbox = region.getByRole("checkbox", { name: "Возобновить абонемент" });
        if (kind !== "frozen") await expect(checkbox).toHaveCount(0);
        else {
          await expect(checkbox).not.toBeChecked();
          const hitbox = await checkbox.locator("..").boundingBox();
          assert.ok(hitbox.height >= 44, `resume label hitbox ${hitbox.height}px at ${width}`);
          await page.screenshot({ path: `${output}trainer-subscription-frozen-${width}.png`, fullPage: true });
          await checkbox.locator("..").click(); await expect(checkbox).toBeChecked();
          await region.getByRole("button", { name: "Сохранить абонемент" }).click();
          await expect.poll(() => page.evaluate(() => window.saved?.resumeSubscription)).toBe(true);
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `horizontal overflow at ${width}/${kind}`);
        if (kind === "new") await page.screenshot({ path: `${output}trainer-subscription-new-${width}.png`, fullPage: true });
      }
      await page.evaluate(() => window.show("frozen", false));
      const dialog = page.getByRole("dialog", { name: "Редактирование абонемента" }); await expect(dialog).toBeVisible();
      const colors = await dialog.getByText("АБОНЕМЕНТ", { exact: true }).evaluate(element => ({
        text: getComputedStyle(element).color,
        background: getComputedStyle(element.closest('[role="dialog"]')).backgroundColor
      }));
      const luminance = color => {
        const [red, green, blue] = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
          const channel = value / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      };
      const foreground = luminance(colors.text), background = luminance(colors.background);
      const contrast = (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
      assert.ok(contrast >= 4.5, `subscription eyebrow contrast ${contrast.toFixed(2)}:1 at ${width}px (${colors.text} / ${colors.background})`);
      await expect(dialog.getByRole("checkbox", { name: "Возобновить абонемент" })).not.toBeChecked();
      await page.screenshot({ path: `${output}trainer-subscription-sheet-${width}.png`, fullPage: true });
      await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
      await expect.poll(() => page.evaluate(() => window.saved?.resumeSubscription)).toBe(false);
      assert.deepEqual(errors, []); await page.close();
    }
  } finally { await browser.close(); }
});
