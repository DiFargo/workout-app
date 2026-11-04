// Fully local actual-component/service/backend diagnostic with native media.
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { rolldown } from "rolldown";
import { chromium, webkit } from "playwright";
import { createProtectedExerciseVideoAccess, EXERCISE_VIDEO_PRIVATE_CACHE } from "../functions/protectedExerciseVideo.js";

const output = resolve("output/playwright/protected-poster-only");
await mkdir(output, { recursive: true });
const assets = resolve("output/playwright/exercise-preview-assets-3.0.868");
const manifest = JSON.parse(await readFile(resolve(assets, "manifest.json"), "utf8"));
const image = await readFile(resolve(assets, manifest.assets[0].filename));
const video = await readFile(resolve("public/videos/7c60b873-fe00-4844-813a-23ef8811f019.mp4"));
const component = resolve("src/components/media/ProtectedExerciseVideo.jsx").replaceAll("\\", "/");
const css = await readFile(resolve("src/components/media/ProtectedExerciseVideo.module.css"), "utf8");
const bundle = await rolldown({ input: "poster-only-probe", platform: "browser", transform: { jsx: { runtime: "automatic" }, define: { "import.meta.env": "({DEV:false})" } }, plugins: [{
  name: "local-poster-only",
  resolveId(id) {
    if (id === "poster-only-probe") return id;
    if (id === "firebase/auth") return "probe-auth";
    if (/\/firebase(?:\.js)?$/.test(id)) return "probe-app";
    if (id.endsWith("/apiClient.js")) return "probe-api";
    return null;
  },
  load(id) {
    if (id.endsWith(".css")) return { moduleType: "js", code: `const style=document.createElement('style');style.textContent=${JSON.stringify(css)};document.head.appendChild(style);export default{poster:'poster'};` };
    if (id === "probe-app") return "export const auth={currentUser:{uid:'synthetic'}};export const app={options:{storageBucket:'app.test'}};";
    if (id === "probe-auth") return "export const onAuthStateChanged=()=>()=>{};";
    if (id === "probe-api") return "export const fetchAuthorizedWithTimeout=(url,options)=>fetch('https://app.test'+url,options);";
    if (id === "poster-only-probe") return { moduleType: "jsx", code: `
      import React from'react';import{createRoot}from'react-dom/client';import Video from ${JSON.stringify(component)};
      window.events=[];window.errors=[];const event=(name,e)=>window.events.push({name,time:e.currentTarget.currentTime});
      createRoot(document.getElementById('root')).render(<section id='frame'><Video src='gs://app.test/exercise-videos/local.mp4' preferPoster previewTime={2}
      preload='auto' playsInline className='media' onPlay={e=>event('play',e)} onPlaying={e=>event('playing',e)} onLoadedMetadata={e=>event('metadata',e)}
      onError={e=>window.errors.push({code:e.currentTarget.error?.code,message:e.currentTarget.error?.message})}/>
      <button onClick={e=>e.currentTarget.parentElement.querySelector('video').play().catch(error=>window.errors.push({play:error.name}))}>Воспроизвести</button></section>);
    ` };
    return null;
  }
}] });
const generated = await bundle.generate({ format: "iife", codeSplitting: false }); await bundle.close();
const code = generated.output.find(part => part.type === "chunk").code;
const results = [];
const baselines = [];
for (const [name, engine] of [["chromium", chromium], ["webkit", webkit]]) {
  let browser;
  try { browser = await engine.launch(); } catch (error) { results.push({ browser: name, status: "unavailable", error: error.message }); continue; }
  try {
    const control = await browser.newPage();
    let controlGets = 0;
    await control.route("**/*", route => {
      if (route.request().url() === "https://app.test/") return route.fulfill({ contentType: "text/html", body: '<video src="https://cdn-probe.test/video.mp4" preload="none" playsinline></video><button onclick="document.querySelector(\'video\').play().catch(error=>window.playError=error.name)">Play</button>' });
      if (route.request().url() === "https://cdn-probe.test/video.mp4") {
        controlGets++; const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range || "");
        const start = Number(range?.[1] || 0), end = Math.min(video.length - 1, range?.[2] ? Number(range[2]) : video.length - 1);
        return route.fulfill({ status: range ? 206 : 200, contentType: "video/mp4", body: video.subarray(start, end + 1),
          headers: { "accept-ranges": "bytes", ...(range ? { "content-range": `bytes ${start}-${end}/${video.length}` } : {}) } });
      }
      return route.abort();
    });
    await control.goto("https://app.test/"); await control.getByRole("button", { name: "Play", exact: true }).click();
    await control.waitForFunction(() => document.querySelector("video").readyState >= 2 || document.querySelector("video").error || window.playError, null, { timeout: 5000 }).catch(() => {});
    const baseline = await control.evaluate(() => { const video = document.querySelector("video"); return { readyState: video.readyState, paused: video.paused, errorCode: video.error?.code, playError: window.playError }; });
    baselines.push({ browser: name, nativeWithoutReact: true, videoGets: controlGets, ...baseline }); await control.close();
    for (const mode of ["ready", "missing", "404", "corrupt"]) {
      const page = await browser.newPage({ viewport: { width: 402, height: 760 } });
      const counts = { videoSigns: 0, posterSigns: 0, videoGets: 0, posterGets: 0, unexpected: 0 };
      const requests = [], pageErrors = [];
      page.on("pageerror", error => pageErrors.push(error.message));
      const storage = { bucket: () => ({ file: path => ({
        async getMetadata() { const poster = path.endsWith(".webp"); if (poster && mode === "missing") throw Object.assign(new Error("missing"), { code: 404 });
          return [{ name: path, bucket: "app.test", contentType: poster ? "image/webp" : "video/mp4", size: String(poster ? image.length : video.length), cacheControl: EXERCISE_VIDEO_PRIVATE_CACHE }]; },
        async getSignedUrl() { const poster = path.endsWith(".webp"); counts[poster ? "posterSigns" : "videoSigns"]++; return [`https://cdn-probe.test/${poster ? "poster.webp" : "video.mp4"}`]; }
      }) }) };
      await page.route("**/*", async route => {
        const url = route.request().url();
        if (url.startsWith("blob:https://app.test/")) return route.continue();
        if (url === "https://app.test/") return route.fulfill({ contentType: "text/html", body: '<!doctype html><style>body{margin:0;padding:12px;background:#f2f2f7}#frame{position:relative;width:378px;height:420px}.media{width:378px;height:378px;object-fit:contain;background:#111}button{position:absolute;top:382px}</style><main id="root"></main>' });
        if (url === "https://app.test/api/exercise-video-access") {
          const body = route.request().postDataJSON(); requests.push(body);
          const result = await createProtectedExerciseVideoAccess({ storage, bucketName: "app.test", context: { uid: "synthetic", userData: { role: "client" } }, ...body });
          return route.fulfill({ json: result });
        }
        if (url === "https://cdn-probe.test/poster.webp") { counts.posterGets++; return route.fulfill({ status: mode === "404" ? 404 : 200, contentType: "image/webp",
          body: mode === "corrupt" ? Buffer.from("not-webp") : image, headers: { "access-control-allow-origin": "https://app.test", "cache-control": "no-store" } }); }
        if (url === "https://cdn-probe.test/video.mp4") {
          counts.videoGets++; const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range || "");
          const start = Number(range?.[1] || 0), end = Math.min(video.length - 1, range?.[2] ? Number(range[2]) : video.length - 1);
          return route.fulfill({ status: range ? 206 : 200, contentType: "video/mp4", body: video.subarray(start, end + 1),
            headers: { "accept-ranges": "bytes", "access-control-allow-origin": "https://app.test", ...(range ? { "content-range": `bytes ${start}-${end}/${video.length}` } : {}) } });
        }
        counts.unexpected++; return route.abort();
      });
      const result = { browser: name, mode, status: "failed" };
      try {
        await page.goto("https://app.test/"); await page.addScriptTag({ content: code });
        await page.waitForFunction(() => document.querySelector("video")?.dataset.protectedVideoState === "ready");
        if (mode === "ready") await page.waitForFunction(() => document.querySelector("img[data-video-poster]")?.naturalWidth > 0);
        else await page.waitForFunction(() => document.querySelector("video")?.dataset.videoPreviewMode === "unavailable");
        result.beforePlay = { ...counts }; assert.equal(counts.videoSigns, 0); assert.equal(counts.videoGets, 0);
        assert.equal(await page.locator("video").getAttribute("src"), null);
        await page.screenshot({ path: resolve(output, `${name}-${mode}.png`) });
        await page.getByRole("button", { name: "Воспроизвести", exact: true }).click();
        await page.waitForFunction(() => window.events.some(event => event.name === "playing") || window.errors.length, null, { timeout: name === "webkit" ? 3000 : 10000 });
        result.events = await page.evaluate(() => window.events); result.mediaErrors = await page.evaluate(() => window.errors);
        assert.equal(counts.videoSigns, 1);
        if (result.mediaErrors.length) {
          assert.ok(result.mediaErrors.every(error => error.code === 4 || error.play === "NotSupportedError"), JSON.stringify(result.mediaErrors));
          result.status = "native-playback-unavailable";
        }
        else { assert.ok(result.events.some(event => event.name === "playing")); assert.ok(result.events.find(event => event.name === "play").time < .25); result.status = "passed"; }
        assert.deepEqual(pageErrors, []); assert.equal(counts.unexpected, 0);
      } catch (error) {
        result.error = error.message;
        if (error.message.includes("Timeout") && (baseline.errorCode === 4 || baseline.playError === "NotSupportedError")) result.status = "native-playback-unavailable";
        else if (error.message.includes("Timeout") && baseline.readyState === 0 && controlGets === 0) {
          result.status = "native-playback-unverified";
          result.limitation = "Простой native video без React также не получил ни одного MP4 GET и остался readyState=0; воспроизведение в этом engine не подтверждено.";
        }
      }
      finally { result.afterPlay = { ...counts }; result.requests = requests; result.pageErrors = pageErrors; await page.close(); results.push(result); }
    }
  } finally { await browser.close(); }
}
const result = { localOnly: true, realNetwork: false, nativeMedia: true, baselines, results,
  summary: "До Play проверяются реальные service/backend paths без подписи/GET MP4; затем native Play с нулевого времени. Ошибка codec/engine не считается успешным воспроизведением." };
await writeFile(resolve(output, "result.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
if (results.some(result => result.status === "failed")) process.exitCode = 1;
