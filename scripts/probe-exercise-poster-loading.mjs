// Diagnostic only: real browser media, local poster bytes, bounded read-only
// GCS Range requests in Node. Credentials never enter browser code or artifacts.
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { rolldown } from "rolldown";
import { chromium, webkit } from "playwright";
import { accountToken } from "./exercise-preview-batch.mjs";

const directory = resolve("output/playwright/workout-loading-3.0.868");
const assetsDirectory = resolve("output/playwright/exercise-preview-assets-3.0.868");
await mkdir(directory, { recursive: true });
const manifest = JSON.parse(await readFile(resolve(assetsDirectory, "manifest.json"), "utf8"));
const asset = manifest.assets.find(item => item.names.includes("Выпады с гантелями"));
assert.ok(asset, "Reviewed lunge asset required");
const poster = await readFile(resolve(assetsDirectory, asset.filename));
const componentPath = resolve("src/components/media/ProtectedExerciseVideo.jsx").replaceAll("\\", "/");
const componentSource = await readFile(componentPath, "utf8");
assert.match(componentSource, /data-video-poster="true"/, "Wait for single image overlay implementation");
const css = await readFile(resolve("src/components/media/ProtectedExerciseVideo.module.css"), "utf8");
const token = await accountToken();
const [, bucket, objectPath] = /^gs:\/\/([^/]+)\/(.+)$/.exec(asset.sourceRef);
const metadataResponse = await fetch(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(objectPath)}?fields=size,generation,contentType`, {
  headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(25000)
});
assert.equal(metadataResponse.status, 200, "Read-only exercise video metadata");
const metadata = await metadataResponse.json();
assert.equal(metadata.generation, asset.sourceGeneration, "Source generation changed since reviewed poster");
assert.ok(/^video\//.test(metadata.contentType));
const size = Number(metadata.size);
const budget = 60 * 1024 * 1024;
let totalVideoBytes = 0;
const bundle = await rolldown({ input: "exercise-poster-probe", platform: "browser", transform: { jsx: { runtime: "automatic" } }, plugins: [{
  name: "real-native-media-probe",
  resolveId(id) { return id === "exercise-poster-probe" || id.endsWith("/utils/protectedExerciseVideo.js") ? id : null; },
  load(id) {
    if (id.endsWith(".css")) return { moduleType: "js", code: `const style=document.createElement('style');style.textContent=${JSON.stringify(css)};document.head.appendChild(style);export default {poster:'poster',error:'error',retry:'retry'};` };
    if (id.endsWith("/utils/protectedExerciseVideo.js")) return `
      export const VIDEO_ACCESS_REFRESH_MARGIN_MS=30000;
      export const protectedExerciseVideoAccess={subscribe(){return()=>{}},getSnapshot(){return 1},isProtected(){return true},invalidate(){},
        getCachedPoster(){return null},async prefetchPoster(){return{url:'https://local-media-probe.test/poster.webp'}},
        resolve(){return Promise.resolve({url:'https://local-media-probe.test/video',posterUrl:'https://local-media-probe.test/poster.webp',expiresAt:null})}};
    `;
    if (id === "exercise-poster-probe") return { moduleType: "jsx", code: `
      import React,{useRef}from'react';import{createRoot}from'react-dom/client';import Video from ${JSON.stringify(componentPath)};
      window.probe={events:[],errors:[]};
      const event=(name,e)=>window.probe.events.push({name,time:e.currentTarget.currentTime,readyState:e.currentTarget.readyState,at:performance.now()});
      function Scene(){const ref=useRef();return <main><section id="frame"><Video ref={ref} src=${JSON.stringify(asset.sourceRef)} previewTime={${asset.previewTime}} preferPoster muted playsInline preload="metadata" className="media"
        onPlay={e=>event('play',e)} onPlaying={e=>event('playing',e)} onSeeked={e=>event('seeked',e)} onLoadedMetadata={e=>event('metadata',e)}
        onError={e=>window.probe.errors.push({code:e.currentTarget.error?.code,message:e.currentTarget.error?.message})}/></section>
        <button type="button" onClick={()=>ref.current.play().catch(error=>window.probe.errors.push({play:error.name}))}>Воспроизвести</button></main>}
      createRoot(document.getElementById('root')).render(<Scene/>);
    ` };
    return null;
  }
}] });
const generated = await bundle.generate({ format: "iife", codeSplitting: false });
await bundle.close();
const script = generated.output.find(item => item.type === "chunk").code;
const results = [];

async function runScenario(browser, browserName, mode) {
  const page = await browser.newPage({ viewport: { width: 402, height: 760 } });
  const network = { imageRequests: 0, videoRequests: 0, imageBytes: 0, videoBytes: 0 };
  const errors = [];
  const inFlight = new Set();
  let closing = false;
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://local-media-probe.test/**", async route => {
    let complete;
    const done = new Promise(resolve => { complete = resolve; });
    inFlight.add(done);
    try {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/poster.webp") {
      network.imageRequests++;
      const body = mode === "corrupt" ? Buffer.from("invalid-webp-data") : poster;
      network.imageBytes += mode === "404" ? 0 : body.length;
      return route.fulfill({ status: mode === "404" ? 404 : 200, contentType: "image/webp", body: mode === "404" ? "" : body });
    }
    if (pathname !== "/video") return route.abort();
    network.videoRequests++;
    const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range || "bytes=0-");
    assert.ok(range, "Only ordinary bounded byte ranges expected");
    const start = Number(range[1]);
    const end = Math.min(size - 1, range[2] ? Number(range[2]) : size - 1, start + 512 * 1024 - 1);
    if (start >= size) return route.fulfill({ status: 416, headers: { "content-range": `bytes */${size}` } });
    try {
      assert.ok(totalVideoBytes + end - start + 1 <= budget, "60 MiB video budget exceeded");
      const response = await fetch(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(objectPath)}?alt=media&generation=${metadata.generation}`, {
        headers: { Authorization: `Bearer ${token}`, Range: `bytes=${start}-${end}` }, signal: AbortSignal.timeout(25000)
      });
      assert.equal(response.status, 206, "GCS must honor real media ranges");
      const bytes = Buffer.from(await response.arrayBuffer());
      totalVideoBytes += bytes.length; network.videoBytes += bytes.length;
      assert.ok(totalVideoBytes <= budget);
      await route.fulfill({ status: 206, contentType: metadata.contentType,
        headers: { "accept-ranges": "bytes", "content-range": `bytes ${start}-${start + bytes.length - 1}/${size}`, "access-control-allow-origin": "*" }, body: bytes });
    } catch (error) {
      if (!closing) errors.push(`Range proxy: ${error.message}`);
      await route.abort().catch(() => {});
    }
    } finally { inFlight.delete(done); complete(); }
  });
  const started = Date.now();
  const result = { browser: browserName, mode, selectedTime: asset.previewTime, status: "failed" };
  try {
    await page.setContent('<!doctype html><html><head><style>body{margin:0;background:#f2f2f7;font-family:Arial}main{padding:12px}#frame{position:relative;width:378px;height:378px;background:#111}.media{width:100%;height:100%;object-fit:contain}button{display:block;margin-top:16px;min-height:48px;width:100%}</style></head><body><div id="root"></div></body></html>');
    await page.addScriptTag({ content: script });
    result.nativeCapabilities = await page.evaluate(() => { const video=document.createElement('video');return {
      mp4:video.canPlayType('video/mp4'),h264:video.canPlayType('video/mp4; codecs="avc1.42E01E"'),
      webm:video.canPlayType('video/webm; codecs="vp8"') }; });
    const canDecode = Boolean(result.nativeCapabilities.mp4 || result.nativeCapabilities.h264);
    if (mode === "ready") {
      await page.waitForFunction(() => { const image=document.querySelector('[data-video-poster]');return image?.complete&&image.naturalWidth>0; }, null, { timeout: 15000 });
      await page.waitForTimeout(700);
      result.beforePlay = { ...network, ...await page.locator("video").evaluate(video => ({ preload: video.preload, readyState: video.readyState, currentTime: video.currentTime })) };
      assert.equal(network.imageRequests, 1, "One image request, no duplicate native poster");
      assert.equal(network.videoRequests, 0, "A decoded WebP preview must not request MP4 before Play");
    } else {
      await page.waitForFunction(() => document.querySelector('video')?.dataset.videoPreviewMode==='seek', null, { timeout: 15000 });
      if (canDecode) {
        await page.waitForFunction(selected => { const video=document.querySelector('video');return video?.error?.code===4||(video?.readyState>=2&&!video.seeking&&Math.abs(video.currentTime-selected)<.15); }, asset.previewTime, { timeout: 30000 });
        assert.equal(await page.locator("video").evaluate(video => video.error?.code || 0), 0, "Native media rejected the MP4 source before decoding");
      }
      result.beforePlay = { ...network, ...await page.locator("video").evaluate(video => ({ preload: video.preload, readyState: video.readyState, currentTime: video.currentTime })) };
      assert.equal(network.imageRequests, 1);
      if (canDecode) assert.ok(network.videoRequests > 0, "Failed poster must trigger native media fallback");
      assert.equal(result.beforePlay.preload, "metadata");
    }
    await page.screenshot({ path: resolve(directory, `${browserName}-${mode}-before-play.png`) });
    if (!canDecode) {
      result.status = "codec_unavailable";
      result.nativePlaybackVerified = false;
      result.limitation = "WebP/fallback mode checked; this native browser reports no MP4/H.264 decoder, so seek/play cannot be verified.";
      throw Object.assign(new Error("Native MP4/H.264 codec unavailable"), { code: "codec_unavailable" });
    }
    await page.getByRole("button", { name: "Воспроизвести", exact: true }).click();
    await page.waitForFunction(() => { const video=document.querySelector('video');return video?.error?.code===4||(video&&!video.paused&&video.currentTime>.15&&video.currentTime<2); }, null, { timeout: 30000 });
    assert.equal(await page.locator("video").evaluate(video => video.error?.code || 0), 0, "Native media rejected the MP4 source before playback");
    const play = await page.evaluate(() => ({ ...window.probe, currentTime: document.querySelector('video').currentTime,
      paused: document.querySelector('video').paused, readyState: document.querySelector('video').readyState }));
    assert.ok(play.events.some(event => event.name === "playing"), "Native playing event required");
    assert.ok(play.events.find(event => event.name === "play")?.time < .25, "First Play starts at zero, never at selected preview time");
    assert.equal(play.errors.length, 0);
    await page.locator("video").evaluate(video => video.pause());
    result.playback = play; result.status = "passed";
  } catch (error) {
    if (error.code !== "codec_unavailable") result.error = error.message;
    result.state = await page.evaluate(() => ({ probe: window.probe, video: (() => { const video=document.querySelector('video');return video ? { currentTime:video.currentTime,readyState:video.readyState,networkState:video.networkState,paused:video.paused,seeking:video.seeking,mode:video.dataset.videoPreviewMode,error:video.error?.code } : null; })() })).catch(() => null);
    if (browserName === "webkit" && network.videoRequests === 0 && result.state?.video?.error === 4) {
      result.status = "native_rejected_before_network";
      result.nativePlaybackVerified = false;
      result.limitation = "Native WebKit rejected this source with MEDIA_ERR_SRC_NOT_SUPPORTED before any MP4 request, despite canPlayType support claims. Exact platform cause is unconfirmed; seek/play are not verified.";
    }
  } finally {
    closing = true;
    await page.close();
    await Promise.all([...inFlight]);
    result.durationMs = Date.now() - started; result.network = { ...network }; result.errors = errors;
  }
  results.push(result);
  await writeFile(resolve(directory, "real-media-poster-probe.json"), JSON.stringify({ capturedAt: new Date().toISOString(), viewport: "402x760", realNativeMedia: true,
    sourceGeneration: metadata.generation, sourceBytes: size, posterBytes: poster.length, totalVideoBytes, maximumVideoBytes: budget, results }, null, 2) + "\n");
  console.log(JSON.stringify({ browser: browserName, mode, status: result.status, network: result.network, error: result.error }));
}

for (const [name, browserType] of [["chromium", chromium], ["webkit", webkit]]) {
  let browser;
  try { browser = await browserType.launch({ headless: true }); }
  catch (error) {
    results.push({ browser: name, status: "unavailable", error: error.message.split("\n")[0] });
    continue;
  }
  try { for (const mode of ["ready", "404", "corrupt"]) await runScenario(browser, name, mode); }
  finally { await browser.close(); }
}
await writeFile(resolve(directory, "real-media-poster-probe.json"), JSON.stringify({ capturedAt: new Date().toISOString(), viewport: "402x760", realNativeMedia: true,
  sourceGeneration: metadata.generation, sourceBytes: size, posterBytes: poster.length, totalVideoBytes, maximumVideoBytes: budget, results }, null, 2) + "\n");
if (results.some(result => result.status === "failed")) process.exitCode = 1;
