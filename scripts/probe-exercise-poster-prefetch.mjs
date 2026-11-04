// Local-only browser diagnostic. Actual access factory/component, native
// fetch/Blob/image/media APIs. No credentials, real users, or remote requests.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { rolldown } from "rolldown";
import { chromium, webkit } from "playwright";

const directory = resolve("output/playwright/workout-loading-3.0.869");
const assets = resolve("output/playwright/exercise-preview-assets-3.0.868");
await mkdir(directory, { recursive: true });
const manifest = JSON.parse(await readFile(resolve(assets, "manifest.json"), "utf8"));
const asset = manifest.assets.find(asset => asset.names.includes("Сгибание ног в тренажере"));
assert.ok(asset, "Локальная обложка сгибания ног обязательна");
const image = await readFile(resolve(assets, asset.filename));
const source = "gs://app.test/exercise-videos/local-prefetch-probe.mp4";
const component = resolve("src/components/media/ProtectedExerciseVideo.jsx").replaceAll("\\", "/");
const service = resolve("src/utils/protectedExerciseVideo.js").replaceAll("\\", "/");
const css = await readFile(resolve("src/components/media/ProtectedExerciseVideo.module.css"), "utf8");
assert.match(await readFile(service, "utf8"), /prefetchPoster\(/, "Ожидается реальный API предзагрузки");
const bundle = await rolldown({ input: "poster-prefetch-probe", platform: "browser", transform: { jsx: { runtime: "automatic" }, define: { "import.meta.env": "({DEV:false})" } }, plugins: [{
  name: "local-poster-prefetch-diagnostic",
  resolveId(id) {
    if (id === "poster-prefetch-probe") return id;
    if (id === "firebase/auth") return "probe-firebase-auth";
    if (/\/firebase(?:\.js)?$/.test(id)) return "probe-firebase-app";
    if (id.endsWith("/apiClient.js")) return "probe-api-client";
    return null;
  },
  load(id) {
    if (id.endsWith(".css")) return { moduleType: "js", code: `const style=document.createElement('style');style.textContent=${JSON.stringify(css)};document.head.appendChild(style);export default{poster:'poster',error:'error',retry:'retry'};` };
    if (id === "probe-firebase-app") return `
      export const auth={currentUser:{uid:'synthetic-local-owner'}};
      export const app={options:{storageBucket:'app.test'}};
      window.probeAuth=auth;
    `;
    if (id === "probe-firebase-auth") return `
      const listeners=new Set();
      export const onAuthStateChanged=(auth,listener)=>{listeners.add(listener);return()=>listeners.delete(listener)};
      window.probeChangeUser=user=>{window.probeAuth.currentUser=user;for(const listener of listeners)listener(user)};
    `;
    if (id === "probe-api-client") return `
      window.probeApiCalls=[];
      export const fetchAuthorizedWithTimeout=async(url,options)=>{
        window.probeApiCalls.push({url,body:JSON.parse(options.body)});
        return {ok:true,status:200,json:async()=>({ok:true,url:'https://cdn-prefetch-probe.test/video.mp4',
          posterUrl:'https://cdn-prefetch-probe.test/poster.webp',expiresAt:new Date(Date.now()+15*60*1000).toISOString()})};
      };
    `;
    if (id === "poster-prefetch-probe") return { moduleType: "jsx", code: `
      import React from'react';import{createRoot}from'react-dom/client';
      import Video from ${JSON.stringify(component)};
      import{protectedExerciseVideoAccess,createProtectedExerciseVideoAccess}from ${JSON.stringify(service)};
      window.probeAccess=protectedExerciseVideoAccess;
      window.probeFactoryIsActual=typeof createProtectedExerciseVideoAccess==='function';
      const root=createRoot(document.getElementById('root'));let generation=0;
      const source=${JSON.stringify(source)},previewTime=${asset.previewTime};
      window.probePrefetch=()=>protectedExerciseVideoAccess.prefetchPoster(source,{previewTime});
      window.probeCached=()=>protectedExerciseVideoAccess.getCachedPoster(source,{previewTime});
      document.addEventListener('load',event=>{const image=event.target;if(!image.matches?.('img[data-video-poster]')||!image.naturalWidth)return;
        requestAnimationFrame(()=>{if(image.isConnected&&window.probeVisibleAfterMs===null)window.probeVisibleAfterMs=performance.now()-window.probeMountStarted})},true);
      window.probeMount=()=>{window.probeMountStarted=performance.now();window.probeVisibleAfterMs=null;root.render(<section id='frame'><Video key={++generation} className='media'
        src={source} previewTime={previewTime} preferPoster preload='auto' muted playsInline /></section>)};
      window.probeUnmount=()=>root.render(null);
      window.probePosterReady=()=>{const image=document.querySelector('img[data-video-poster]');return Boolean(image?.complete&&image.naturalWidth>0&&Number.isFinite(window.probeVisibleAfterMs))};
    ` };
    return null;
  }
}] });
const generated = await bundle.generate({ format: "iife", codeSplitting: false });
await bundle.close();
const code = generated.output.find(item => item.type === "chunk").code;
const results = [];
const delayMs = 900;

async function createProbePage(browser) {
  const page = await browser.newPage({ viewport: { width: 402, height: 760 } });
  const network = { posterGets: 0, posterBytes: 0, mp4Gets: 0, unexpectedRequests: 0 };
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", async route => {
    const url = route.request().url();
    // WebKit surfaces local blob decoding through routing; Chromium does not.
    // Let the browser resolve its own in-memory URL, never proxy it to a host.
    if (url.startsWith("blob:https://app.test/")) return route.continue();
    if (url === "https://app.test/") return route.fulfill({ contentType: "text/html", body: '<!doctype html><html><head><style>body{margin:0;padding:12px;background:#f2f2f7}#frame{position:relative;width:378px;height:378px;background:#111}.media{width:100%;height:100%;object-fit:contain}</style></head><body><main id="root"></main></body></html>' });
    if (url === "https://cdn-prefetch-probe.test/poster.webp") {
      network.posterGets++;
      await new Promise(resolve => setTimeout(resolve, delayMs));
      network.posterBytes += image.length;
      return route.fulfill({ contentType: "image/webp", body: image,
        headers: { "access-control-allow-origin": "https://app.test", "cache-control": "no-store", "content-length": String(image.length) } });
    }
    if (url === "https://cdn-prefetch-probe.test/video.mp4") { network.mp4Gets++; return route.abort(); }
    network.unexpectedRequests++;
    return route.abort();
  });
  await page.goto("https://app.test/", { waitUntil: "domcontentloaded" });
  await page.addScriptTag({ content: code });
  assert.equal(await page.evaluate(() => window.probeFactoryIsActual), true);
  return { page, network, errors };
}

async function mountAndMeasure(page) {
  await page.evaluate(() => window.probeMount());
  await page.waitForFunction(() => window.probePosterReady(), null, { timeout: 6000 });
  return page.evaluate(() => ({ visibleAfterMs: window.probeVisibleAfterMs,
    blobImage: document.querySelector('[data-video-poster]').src.startsWith('blob:'),
    width: document.querySelector('[data-video-poster]').naturalWidth,
    preload: document.querySelector('video').preload,
    mode: document.querySelector('video').dataset.videoPreviewMode }));
}

async function warmProbe(browser, name) {
  const { page, network, errors } = await createProbePage(browser);
  const result = { browser: name, scenario: "warm-prefetch-remount-auth-reset", status: "failed" };
  try {
    const started = Date.now();
    const prefetched = await page.evaluate(async () => {
      const [first, second] = await Promise.all([window.probePrefetch(),window.probePrefetch()]);
      window.probeOldBlob=first?.url;
      return { blob:first?.url?.startsWith('blob:'),deduplicated:first?.url===second?.url,apiCalls:window.probeApiCalls.length };
    });
    result.prefetchMs = Date.now()-started;
    assert.ok(prefetched.blob && prefetched.deduplicated);
    assert.equal(prefetched.apiCalls, 1);
    assert.equal(network.posterGets, 1);
    assert.equal(network.mp4Gets, 0);
    result.firstMount = await mountAndMeasure(page);
    assert.ok(result.firstMount.visibleAfterMs < 250, "Прогретая обложка должна появиться быстрее 250 мс");
    assert.ok(result.firstMount.blobImage);
    assert.equal(result.firstMount.preload, "none");
    assert.equal(network.posterGets, 1);
    await page.screenshot({ path: resolve(directory, `${name}-warm-poster.png`) });
    await page.evaluate(() => window.probeUnmount());
    await page.locator("video").waitFor({ state: "detached" });
    result.remount = await mountAndMeasure(page);
    // The explicit sub-250 ms acceptance targets the first warmed mount.
    // Record remount timing separately; its required guarantee is no new GET.
    assert.equal(network.posterGets, 1);
    assert.equal(network.mp4Gets, 0);
    result.warmNetwork = { ...network };
    await page.evaluate(() => window.probeUnmount());
    await page.locator("video").waitFor({ state: "detached" });
    result.authReset = await page.evaluate(async () => {
      window.probeChangeUser(null);
      const emptyAfterLogout=window.probeCached()===null;
      const oldBlobRevoked=await fetch(window.probeOldBlob).then(()=>false,()=>true);
      window.probeChangeUser({uid:'synthetic-local-owner'});
      return { emptyAfterLogout,oldBlobRevoked,emptySameUidNewSession:window.probeCached()===null };
    });
    assert.deepEqual(result.authReset, { emptyAfterLogout: true, oldBlobRevoked: true, emptySameUidNewSession: true });
    const next = await page.evaluate(async () => {const entry=await window.probePrefetch();return { newBlob:entry?.url!==window.probeOldBlob,apiCalls:window.probeApiCalls.length };});
    assert.equal(next.newBlob, true);
    assert.equal(next.apiCalls, 2);
    assert.equal(network.posterGets, 2);
    result.afterRelogin = await mountAndMeasure(page);
    assert.equal(network.posterGets, 2);
    assert.equal(network.mp4Gets, 0);
    assert.equal(network.unexpectedRequests, 0);
    assert.deepEqual(errors, []);
    result.status = "passed";
    result.summary = "Предзагрузка дедуплицирована; первый показ и повторный вход используют готовый Blob без GET. Выход отзывает Blob, новый вход того же UID требует новую загрузку.";
  } catch (error) { result.error = error.message; }
  finally { result.network = { ...network }; result.pageErrors = errors; await page.close(); }
  results.push(result);
}

async function coldProbe(browser, name) {
  const { page, network, errors } = await createProbePage(browser);
  const result = { browser: name, scenario: "cold-component", status: "failed" };
  try {
    result.mount = await mountAndMeasure(page);
    assert.ok(result.mount.visibleAfterMs >= delayMs-50, "Холодный показ должен включать настоящую задержку загрузки");
    assert.ok(result.mount.blobImage);
    assert.equal(result.mount.preload, "none");
    assert.equal(network.posterGets, 1);
    assert.equal(network.mp4Gets, 0);
    assert.equal(network.unexpectedRequests, 0);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: resolve(directory, `${name}-cold-poster.png`) });
    result.status = "passed";
    result.summary = "Холодный компонент получил одну WebP через фактический prefetch API; MP4 до Play не запрашивается.";
  } catch (error) { result.error = error.message; }
  finally { result.network = { ...network }; result.pageErrors = errors; await page.close(); }
  results.push(result);
}

for (const [name, type] of [["chromium", chromium], ["webkit", webkit]]) {
  let browser;
  try { browser=await type.launch({headless:true}); }
  catch (error) { results.push({ browser:name,status:"unavailable",error:error.message.split("\n")[0] }); continue; }
  try { await warmProbe(browser,name); await coldProbe(browser,name); }
  finally { await browser.close(); }
}
const report = { capturedAt: new Date().toISOString(), localOnly: true, realServiceFactory: true, realComponent: true, nativeMediaUnmodified: true,
  viewport: "402x760", measurement: "performance.now: mount -> native image load -> requestAnimationFrame, without Node polling overhead",
  imageName: "Сгибание ног в тренажере", imageBytes: image.length, networkDelayMs: delayMs,
  realUsersRead: false, productionRequests: false, results };
await writeFile(resolve(directory,"poster-prefetch-probe.json"),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report));
if(results.some(result=>result.status==="failed"))process.exitCode=1;
