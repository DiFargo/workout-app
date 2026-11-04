import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { chromium, expect } from "@playwright/test";

const component = JSON.stringify(fileURLToPath(new URL("../src/components/media/PrivateProgressPhoto.jsx", import.meta.url)).replaceAll("\\", "/"));
const bucket = "own-bucket.firebasestorage.app";
const legacy = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/progress-photos%2Fowner%2Fsession%2Ffront.webp?alt=media&token=NEVER-HTTP`;
const bundle = await rolldown({ input: "private-photo-react", platform: "browser", transform: { jsx: { runtime: "automatic" } },
  plugins: [{ name: "private-photo-test", resolveId(id) {
    if (id === "private-photo-react") return id;
    if (/\/firebase(?:\.js)?$/.test(id)) return "photo-firebase";
    if (id === "firebase/auth") return "photo-auth";
    if (id === "firebase/storage") return "photo-storage";
    return null;
  }, load(id) {
    if (id.endsWith(".css")) return { code: "export default {};", moduleType: "js" };
    if (id === "photo-firebase") return `export const app={options:{storageBucket:'${bucket}'}};export const auth={currentUser:{uid:'viewer'}};window.photoAuth=auth;`;
    if (id === "photo-auth") return "window.authListeners=new Set();export const onAuthStateChanged=(_,fn)=>{window.authListeners.add(fn);return()=>window.authListeners.delete(fn)};";
    if (id === "photo-storage") return "window.sdkCalls=[];export const getStorage=()=>({});export const ref=(_,path)=>({path});export const getBlob=(reference,maximum)=>new Promise((resolve,reject)=>window.sdkCalls.push({reference,maximum,resolve,reject}));";
    if (id !== "private-photo-react") return null;
    return { moduleType: "jsx", code: `import React,{useState}from'react';import{createRoot}from'react-dom/client';import Photo from ${component};
      window.revoked=[];const revoke=URL.revokeObjectURL.bind(URL);URL.revokeObjectURL=url=>{window.revoked.push(url);revoke(url)};
      function Scene(){const[source,setSource]=useState(${JSON.stringify(legacy)}),[mounted,setMounted]=useState(true),[preview,setPreview]=useState(''),[viewer,setViewer]=useState(false);window.setSource=setSource;window.setMounted=setMounted;window.setPreview=setPreview;
        if(window.initialNested)return <><button type='button' aria-label='Открыть фото' onClick={()=>setViewer(true)}><Photo source={source} allowRetry={false} alt='Миниатюра' width={64} height={96} data-testid='photo-thumbnail'/></button>{viewer&&<section role='dialog' aria-label='Просмотр фото'><Photo source={source} alt='Просмотр' width={128} height={192} data-testid='photo-viewer'/></section>}</>;
        return mounted?<Photo source={source} preview={preview} alt='Private progress' width={64} height={96} data-testid='private-photo' src='https://evil.test/bypass' srcSet='https://evil.test/bypass 1x'/>:null}
      createRoot(document.getElementById('root')).render(<Scene/>);
      const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
      window.completePhoto=index=>window.sdkCalls[index].resolve(new Blob([Uint8Array.from(atob(png),char=>char.charCodeAt(0))],{type:'image/png'}));
      window.completeInvalidPhoto=index=>window.sdkCalls[index].resolve(new Blob([new Uint8Array([137,80,78,71,13,10,26,10])],{type:'image/png'}));
      window.failPhoto=index=>window.sdkCalls[index].reject(Object.assign(new Error('synthetic unavailable'),{code:'storage/retry-limit-exceeded'}));
      window.logoutPhoto=()=>{window.photoAuth.currentUser=null;[...window.authListeners].forEach(fn=>fn(null))};` };
  } }]
});
const generated = await bundle.generate({ format: "iife", codeSplitting: false }); await bundle.close();

test("real private-photo DOM never uses token HTTP/srcset, rejects stale completion and clears on logout/unmount", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(); const http = [];
    page.on("request", request => { if (/^https?:/.test(request.url())) http.push(request.url()); });
    await page.setContent('<main id="root"></main>'); await page.addScriptTag({ content: generated.output[0].code });
    const photo = page.getByTestId("private-photo");
    await expect.poll(() => page.evaluate(() => window.sdkCalls?.length)).toBe(1);
    assert.deepEqual(await page.evaluate(() => ({ path: window.sdkCalls[0].reference.path, maximum: window.sdkCalls[0].maximum })), { path: "progress-photos/owner/session/front.webp", maximum: 10485760 });
    await expect(photo).not.toHaveAttribute("src"); await expect(photo).not.toHaveAttribute("srcset");
    await expect(photo).toHaveAttribute("width", "64"); await expect(photo).toHaveAttribute("height", "96");
    await page.evaluate(value => window.setSource(value), `gs://${bucket}/progress-photos/owner/session/back.webp`);
    await expect.poll(() => page.evaluate(() => window.sdkCalls.length)).toBe(2);
    await page.evaluate(() => window.completePhoto(1)); await expect(photo).toHaveAttribute("src", /^blob:/);
    await expect.poll(() => photo.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    const current = await photo.getAttribute("src");
    await page.evaluate(() => window.completePhoto(0)); await expect(photo).toHaveAttribute("src", current);
    await page.evaluate(() => window.logoutPhoto()); await expect(photo).not.toHaveAttribute("src");
    assert.deepEqual(await page.evaluate(() => window.revoked), [current]);
    await page.evaluate(() => window.setMounted(false)); assert.equal(await page.evaluate(() => window.authListeners.size), 0);
    assert.deepEqual(http, []);
  } finally { await browser.close(); }
});

test("local data previews require explicit preview prop and are never accepted as persisted sources", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(); await page.setContent('<main id="root"></main>'); await page.addScriptTag({ content: generated.output[0].code });
    const photo = page.getByTestId("private-photo"), data = "data:image/png;base64,iVBORw0KGgo=";
    await page.evaluate(value => window.setSource(value), data);
    await expect(photo).toHaveAttribute("data-private-photo-state", "error"); await expect(photo).not.toHaveAttribute("src");
    await page.evaluate(value => window.setPreview(value), data);
    await expect(photo).toHaveAttribute("src", data); await expect(photo).toHaveAttribute("data-private-photo-state", "preview");
  } finally { await browser.close(); }
});

test("undecodable private image fails visibly and retry restores a decoded guarded blob", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(), http = [];
    page.on("request", request => { if (/^https?:/.test(request.url())) http.push(request.url()); });
    await page.setContent('<main id="root"></main>'); await page.addScriptTag({ content: generated.output[0].code });
    const photo = page.getByTestId("private-photo");
    await expect.poll(() => page.evaluate(() => window.sdkCalls?.length)).toBe(1);
    await page.evaluate(() => window.completeInvalidPhoto(0));
    await expect(photo).toHaveAttribute("data-private-photo-state", "error");
    await expect(photo).not.toHaveAttribute("src");
    await expect(page.getByRole("status")).toContainText("Не удалось загрузить фото");
    await page.getByRole("button", { name: "Повторить загрузку: Private progress", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.sdkCalls.length)).toBe(2);
    await page.evaluate(() => window.completePhoto(1));
    await expect(photo).toHaveAttribute("src", /^blob:/);
    await expect.poll(() => photo.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(photo).not.toHaveAttribute("srcset");
    assert.deepEqual(http, []);
    await page.evaluate(() => window.logoutPhoto()); await expect(photo).not.toHaveAttribute("src");
    assert.equal(await page.evaluate(() => window.revoked.length), 2);
  } finally { await browser.close(); }
});

for (const failure of ["network", "decode"]) {
  test(`thumbnail ${failure} failure has no nested button; parent opens retryable viewer and logout clears recovery`, { timeout: 30000 }, async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage(), http = [];
      page.on("request", request => { if (/^https?:/.test(request.url())) http.push(request.url()); });
      await page.setContent('<main id="root"></main>');
      await page.evaluate(() => { window.initialNested = true; });
      await page.addScriptTag({ content: generated.output[0].code });
      const parent = page.getByRole("button", { name: "Открыть фото", exact: true });
      const thumbnail = page.getByTestId("photo-thumbnail");
      await expect.poll(() => page.evaluate(() => window.sdkCalls?.length)).toBe(1);
      await page.evaluate(kind => kind === "network" ? window.failPhoto(0) : window.completeInvalidPhoto(0), failure);
      await expect(thumbnail).toHaveAttribute("data-private-photo-state", "error");
      await expect(parent.getByRole("status")).toContainText("Не удалось загрузить фото");
      await expect(parent.locator("button")).toHaveCount(0);
      await expect(thumbnail).not.toHaveAttribute("allowretry");
      await parent.click();
      const viewer = page.getByRole("dialog", { name: "Просмотр фото", exact: true });
      await expect(viewer).toBeVisible();
      await expect.poll(() => page.evaluate(() => window.sdkCalls.length)).toBe(2);
      await page.evaluate(() => window.completeInvalidPhoto(1));
      const photo = viewer.getByTestId("photo-viewer");
      await expect(photo).toHaveAttribute("data-private-photo-state", "error");
      await viewer.getByRole("button", { name: "Повторить загрузку: Просмотр", exact: true }).click();
      await expect.poll(() => page.evaluate(() => window.sdkCalls.length)).toBe(3);
      await page.evaluate(() => window.completePhoto(2));
      await expect.poll(() => photo.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
      const recoveredUrl = await photo.getAttribute("src");
      assert.match(recoveredUrl, /^blob:/);
      await expect(page.locator("button button")).toHaveCount(0);
      await expect(photo).not.toHaveAttribute("srcset");
      await page.evaluate(() => window.logoutPhoto());
      await expect(photo).not.toHaveAttribute("src");
      await expect(thumbnail).not.toHaveAttribute("src");
      assert.ok((await page.evaluate(() => window.revoked)).includes(recoveredUrl));
      assert.deepEqual(http, []);
    } finally { await browser.close(); }
  });
}
