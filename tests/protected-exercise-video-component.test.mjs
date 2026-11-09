import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { rolldown } from "rolldown";
import { chromium, expect } from "@playwright/test";

const componentPath = fileURLToPath(new URL("../src/components/media/ProtectedExerciseVideo.jsx", import.meta.url)).replaceAll("\\", "/");
const componentCss = readFileSync(new URL("../src/components/media/ProtectedExerciseVideo.module.css", import.meta.url), "utf8");
const posterImage = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
const bundle = await rolldown({
  input: "protected-video-test-entry", platform: "browser", transform: { jsx: { runtime: "automatic" } },
  plugins: [{
    name: "protected-video-component-test",
    resolveId(id) {
      if (id === "protected-video-test-entry" || id.endsWith("/utils/protectedExerciseVideo.js")) return id;
      return null;
    },
    load(id) {
      if (id.endsWith(".css")) return { code: `const style = document.createElement("style"); style.textContent = ${JSON.stringify(componentCss)}; document.head.appendChild(style); export default { poster: "poster", posterError: "posterError", error: "error", retry: "retry" };`, moduleType: "js" };
      if (id.endsWith("/utils/protectedExerciseVideo.js")) return `
        let session = 0;
        const listeners = new Set();
        window.videoIO = { requests: [], signedCalls: [], invalidations: 0, errors: 0, metadata: 0, playCalls: 0, loadStarts: 0 };
        export const VIDEO_ACCESS_REFRESH_MARGIN_MS = 30000;
        export const protectedExerciseVideoAccess = {
          subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
          getSnapshot() { return session; },
          isProtected(source) { return source?.startsWith("gs://"); },
          invalidate() { window.videoIO.invalidations++; if(window.videoIO.cachedPosterUrl?.startsWith('blob:'))URL.revokeObjectURL(window.videoIO.cachedPosterUrl);window.videoIO.cachedPosterUrl=null; },
          getCachedPoster() { return window.videoIO.cachedPosterUrl ? { url: window.videoIO.cachedPosterUrl } : null; },
          async prefetchPoster() { return window.videoIO.prefetchNull ? null : (window.videoIO.prefetchUrl || window.videoIO.lastPosterUrl) ? { url: window.videoIO.prefetchUrl || window.videoIO.lastPosterUrl } : null; },
          resolve(source, options) {
            if (!this.isProtected(source)) return Promise.resolve({ url: source, expiresAt: null });
            window.videoIO.signedCalls.push({source,options});
            return new Promise((resolve, reject) => window.videoIO.requests.push({ source, options, resolve, reject }));
          }
        };
        window.videoIO.changeSession = () => { session++; listeners.forEach(listener => listener()); };
        window.videoIO.resolve = (url, posterUrl) => { window.videoIO.lastPosterUrl = posterUrl; window.videoIO.requests.splice(0).forEach(item => item.resolve({ ...(item.options.posterOnly ? { posterOnly: true } : { url }), posterUrl, expiresAt: Date.now() + 40000 })); };
        window.videoIO.reject = () => window.videoIO.requests.splice(0).forEach(item => item.reject(new Error("Подпись временно недоступна")));
      `;
      if (id === "protected-video-test-entry") return `
        import React from "react";
        import { createRoot } from "react-dom/client";
        import Video from ${JSON.stringify(componentPath)};
        const times = new WeakMap();
        const playing = new WeakMap();
        Object.defineProperties(HTMLMediaElement.prototype, {
          currentTime: { configurable: true, get() { return times.get(this) || 0; }, set(value) { times.set(this, value); } },
          duration: { configurable: true, get() { return 120; } },
          readyState: { configurable: true, get() { return 1; } },
          paused: { configurable: true, get() { return !playing.get(this); } }
        });
        HTMLMediaElement.prototype.play = function() { playing.set(this, true); window.videoIO.playCalls++; this.dispatchEvent(new Event("play")); return Promise.resolve(); };
        HTMLMediaElement.prototype.pause = function() { playing.set(this, false); };
        HTMLMediaElement.prototype.load = function() {};
        let root;
        function TestPlayer({ videoProps }) {
          const [loading, setLoading] = React.useState(false);
          return React.createElement(React.Fragment, null, React.createElement(Video, {
            ...videoProps,
            onLoadStart: () => { window.videoIO.loadStarts++; setLoading(true); },
            onCanPlay: () => setLoading(false),
            onLoadedMetadata: () => { window.videoIO.metadata++; setLoading(false); }
          }), loading && React.createElement("span", null, "Загрузка видео..."));
        }
        export function mount(source, previewTime, options = {}) {
          root = createRoot(document.getElementById("root"));
          window.videoRef = React.createRef();
          root.render(React.createElement(React.StrictMode, null, React.createElement(TestPlayer, { videoProps: {
            src: source, previewTime, ref: window.videoRef, controls: true, preload: "none", ...options, "aria-label": "Exercise preview",
            onError: () => window.videoIO.errors++
          } })));
        }
        export function unmount() { root.unmount(); }
      `;
      return null;
    }
  }]
});
const generated = await bundle.generate({ format: "iife", name: "ProtectedVideoProbe" });
await bundle.close();

test("protected video forwards native refs/events, retries visibly and refreshes playback without resetting its node", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.clock.install();
    await page.setContent('<main id="root"></main>');
    await page.addScriptTag({ content: generated.output[0].code });
    await page.evaluate(() => window.ProtectedVideoProbe.mount("gs://app/video.mp4"));
    const video = page.getByLabel("Exercise preview");
    await expect(video).toHaveAttribute("controls", "");
    await expect.poll(() => page.evaluate(() => window.videoIO.requests.length)).toBeGreaterThan(0);
    await page.evaluate(() => window.videoIO.reject());
    await expect(page.getByRole("alert")).toContainText("Подпись временно недоступна");
    await page.getByRole("button", { name: "Повторить загрузку" }).click();
    await expect.poll(() => page.evaluate(() => window.videoIO.requests.length)).toBe(1);
    await page.evaluate(() => window.videoIO.resolve("https://signed.test/first"));
    await expect(video).toHaveAttribute("src", "https://signed.test/first");
    assert.equal(await page.evaluate(() => window.videoRef.current === document.querySelector("video")), true);
    await page.evaluate(() => {
      const element = window.videoRef.current;
      element.dispatchEvent(new Event("loadstart"));
      element.dispatchEvent(new Event("loadedmetadata"));
      element.dispatchEvent(new Event("error"));
      element.currentTime = 37;
      element.play();
      window.firstVideoNode = element;
    });
    await page.clock.runFor(10001);
    await expect.poll(() => page.evaluate(() => window.videoIO.requests.length)).toBe(1);
    await expect(video).toHaveAttribute("src", "https://signed.test/first");
    await page.evaluate(() => window.videoIO.resolve("https://signed.test/refreshed"));
    await expect(video).toHaveAttribute("src", "https://signed.test/refreshed");
    await page.evaluate(() => {
      window.videoRef.current.currentTime = 0;
      window.videoRef.current.pause();
      window.videoRef.current.dispatchEvent(new Event("loadedmetadata"));
    });
    const refreshed = await page.evaluate(() => ({
      sameNode: window.firstVideoNode === window.videoRef.current,
      time: window.videoRef.current.currentTime, paused: window.videoRef.current.paused,
      metadata: window.videoIO.metadata, errors: window.videoIO.errors
    }));
    assert.deepEqual(refreshed, { sameNode: true, time: 37, paused: false, metadata: 2, errors: 1 });
    await page.evaluate(() => window.videoIO.changeSession());
    await expect.poll(() => page.evaluate(() => window.videoRef.current !== window.firstVideoNode)).toBe(true);
    await expect(video).not.toHaveAttribute("src");
    assert.equal(await page.evaluate(() => window.firstVideoNode.paused), true);
    assert.equal(await page.evaluate(() => window.firstVideoNode.getAttribute("src")), null);
    assert.equal(await page.evaluate(() => window.videoIO.errors), 1);
  } finally { await browser.close(); }
});

test("public source is synchronous and survives StrictMode rehearsal and unrelated auth changes", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<main id="root"></main>');
    await page.addScriptTag({ content: generated.output[0].code });
    await page.evaluate(() => window.ProtectedVideoProbe.mount("https://external.test/public.mp4"));
    const video = page.getByLabel("Exercise preview");
    await expect(video).toHaveAttribute("src", "https://external.test/public.mp4");
    await page.evaluate(() => { window.publicVideo = window.videoRef.current; window.videoIO.changeSession(); });
    await expect(video).toHaveAttribute("src", "https://external.test/public.mp4");
    assert.equal(await page.evaluate(() => window.publicVideo === window.videoRef.current), true);
    assert.equal(await page.evaluate(() => window.videoIO.requests.length), 0);
  } finally { await browser.close(); }
});

test("chosen preview survives media reload, first play starts at zero and signed refresh preserves real playback", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.clock.install();
    await page.setContent('<main id="root"></main>');
    await page.addScriptTag({ content: generated.output[0].code });
    await page.evaluate(() => window.ProtectedVideoProbe.mount("gs://app/video.mp4", 12));
    const video = page.getByLabel("Exercise preview");
    await expect.poll(() => page.evaluate(() => window.videoIO.requests.length)).toBeGreaterThan(0);
    await page.evaluate(() => window.videoIO.resolve("https://signed.test/first-preview", "https://signed.test/unused-editor-poster.webp"));
    await expect(video).toHaveAttribute("src", "https://signed.test/first-preview");
    await expect(video).not.toHaveAttribute("poster");
    await page.evaluate(() => window.videoRef.current.dispatchEvent(new Event("loadedmetadata")));
    assert.equal(await video.evaluate(node => node.currentTime), 12);
    // A load()/StrictMode reset can reuse the same DOM node and source.
    await video.evaluate(node => { node.currentTime = 0; node.dispatchEvent(new Event("loadedmetadata")); });
    assert.equal(await video.evaluate(node => node.currentTime), 12);
    await video.evaluate(node => node.play());
    assert.equal(await video.evaluate(node => node.currentTime), 0);
    await video.evaluate(node => { node.currentTime = 37; node.pause(); node.play(); });
    assert.equal(await video.evaluate(node => node.currentTime), 37);
    await page.clock.runFor(10001);
    await expect.poll(() => page.evaluate(() => window.videoIO.requests.length)).toBe(1);
    await page.evaluate(() => window.videoIO.resolve("https://signed.test/refreshed-preview"));
    await expect(video).toHaveAttribute("src", "https://signed.test/refreshed-preview");
    await video.evaluate(node => { node.currentTime = 0; node.pause(); node.dispatchEvent(new Event("loadedmetadata")); });
    assert.deepEqual(await video.evaluate(node => ({ time: node.currentTime, paused: node.paused })), { time: 37, paused: false });
  } finally { await browser.close(); }
});

test("opt-in poster avoids video preloading and metadata seek before play, and refresh preserves the player", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    let posterRequests = 0;
    await page.route("https://signed.test/*.webp", async route => {
      posterRequests++;
      await route.fulfill({ contentType: "image/png", body: posterImage });
    });
    await page.clock.install();
    await page.setContent('<style>.exercise-video { position: absolute; inset: 0; width: 100%; height: 100%; }</style><main id="root" style="position:relative;width:320px;height:320px;overflow:hidden"></main>');
    await page.addScriptTag({ content: generated.output[0].code });
    await page.evaluate(() => window.ProtectedVideoProbe.mount("gs://app/video.mp4", 12, { preferPoster: true, preload: "auto",
      className: "exercise-video", style: { objectFit: "cover", objectPosition: "50% 60%", transform: "scale(1.2)", transformOrigin: "50% 60%" } }));
    const video = page.getByLabel("Exercise preview");
    await expect(video).toHaveAttribute("preload", "none");
    await expect(video).not.toHaveAttribute("src");
    await expect(video).toHaveAttribute("data-video-preview-mode", "pending");
    await expect.poll(() => page.evaluate(() => window.videoIO.requests.length)).toBeGreaterThan(0);
    assert.deepEqual(await page.evaluate(() => window.videoIO.requests[0].options), { previewTime: 12, posterOnly: true });
    await page.evaluate(() => window.videoIO.resolve("https://signed.test/video.mp4", "https://signed.test/poster.webp"));
    await expect(video).not.toHaveAttribute("src");
    const poster = page.locator("img[data-video-poster]");
    await expect(poster).toHaveAttribute("src", "https://signed.test/poster.webp");
    await expect.poll(() => poster.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
    await expect(video).not.toHaveAttribute("poster");
    assert.equal(posterRequests, 1, "only the overlay fetches the image; native poster must not fetch it again");
    assert.deepEqual(await poster.boundingBox(), await video.boundingBox());
    assert.equal(await poster.evaluate(node => getComputedStyle(node).pointerEvents), "none");
    await expect(video).toHaveAttribute("preload", "none");
    await expect(video).toHaveAttribute("data-video-preview-mode", "poster");
    await video.evaluate(node => node.dispatchEvent(new Event("loadstart")));
    assert.equal(await page.evaluate(() => window.videoIO.loadStarts), 0);
    await expect(page.getByText("Загрузка видео...")).toHaveCount(0);
    assert.equal(await page.evaluate(() => window.videoIO.metadata), 0, "poster readiness must not fake metadata events");
    await video.evaluate(node => node.dispatchEvent(new Event("loadedmetadata")));
    assert.equal(await video.evaluate(node => node.currentTime), 0, "a poster must never seek the MP4 for its preview");
    assert.equal(await page.evaluate(() => window.videoIO.playCalls), 0);
    await video.evaluate(node => { window.posterVideoNode = node; void node.play(); });
    await expect.poll(() => page.evaluate(() => window.videoIO.requests.length)).toBeGreaterThan(0);
    await page.evaluate(() => window.videoIO.resolve("https://signed.test/video.mp4", "https://signed.test/poster.webp"));
    await expect(video).toHaveAttribute("src", "https://signed.test/video.mp4");
    await video.evaluate(node => { node.dispatchEvent(new Event("loadstart")); node.currentTime = 23; });
    await expect(poster).toHaveCount(1, "play alone must not hide the preview before the first frame");
    assert.ok(await page.evaluate(() => window.videoIO.loadStarts) >= 1);
    await expect(page.getByText("Загрузка видео...")).toBeVisible();
    await video.evaluate(node => node.dispatchEvent(new Event("canplay")));
    await expect(page.getByText("Загрузка видео...")).toHaveCount(0);
    await video.evaluate(node => node.dispatchEvent(new Event("playing")));
    await expect(poster).toHaveCount(0);
    await video.evaluate(node => node.pause());
    await expect(poster).toHaveCount(0, "pause after the first frame must not restore the initial poster");
    await video.evaluate(node => node.play());
    await page.clock.runFor(10001);
    await expect.poll(() => page.evaluate(() => window.videoIO.requests.length)).toBe(1);
    await page.evaluate(() => window.videoIO.resolve("https://signed.test/refresh.mp4", "https://signed.test/refresh.webp"));
    await expect(video).toHaveAttribute("src", "https://signed.test/refresh.mp4");
    await expect(video).toHaveAttribute("preload", "auto");
    await video.evaluate(node => { node.currentTime = 0; node.pause(); node.dispatchEvent(new Event("loadedmetadata")); });
    assert.deepEqual(await video.evaluate(node => ({ sameNode: node === window.posterVideoNode, time: node.currentTime, paused: node.paused })),
      { sameNode: true, time: 23, paused: false });
    await page.evaluate(() => window.videoIO.changeSession());
    await expect(poster).toHaveCount(0);
    await expect(video).not.toHaveAttribute("poster");
    await expect(video).not.toHaveAttribute("src");
    await expect(video).toHaveAttribute("preload", "none");
  } finally { await browser.close(); }
});

test("a null Blob prefetch automatically falls back to the authenticated signed image without MP4", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(); let imageRequests = 0;
    await page.route("https://signed.test/direct.webp", async route => {
      imageRequests++; await route.fulfill({ contentType: "image/png", body: posterImage });
    });
    await page.setContent('<main id="root"></main>');
    await page.addScriptTag({ content: generated.output[0].code });
    await page.evaluate(() => { window.videoIO.prefetchNull = true;
      window.ProtectedVideoProbe.mount("gs://app/video.mp4", 12, { preferPoster: true, preload: "auto" }); });
    await expect.poll(() => page.evaluate(() => window.videoIO.requests.length)).toBeGreaterThan(0);
    await page.evaluate(() => window.videoIO.resolve("https://signed.test/video.mp4", "https://signed.test/direct.webp"));
    const video = page.getByLabel("Exercise preview"), poster = page.locator("img[data-video-poster]");
    await expect(poster).toHaveAttribute("src", "https://signed.test/direct.webp");
    await expect.poll(() => poster.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
    assert.equal(imageRequests, 1);
    await expect(page.getByRole("button", { name: "Повторить загрузку превью", exact: true })).toHaveCount(0);
    await expect(video).not.toHaveAttribute("src"); await expect(video).toHaveAttribute("preload", "none");
    assert.equal(await video.evaluate(node => node.currentTime), 0);
    assert.equal(await page.evaluate(() => window.videoIO.playCalls), 0);
    assert.equal(await page.evaluate(() => window.videoIO.errors), 0);
    assert.equal(await page.evaluate(() => window.videoIO.signedCalls.every(call => call.options.posterOnly)), true);
  } finally { await browser.close(); }
});

test("a corrupt cached Blob is invalidated and replaced by the signed image, not a blank player", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(); let imageRequests = 0;
    await page.route("https://signed.test/direct.webp", async route => {
      imageRequests++; await route.fulfill({ contentType: "image/png", body: posterImage });
    });
    await page.setContent('<main id="root"></main>');
    await page.addScriptTag({ content: generated.output[0].code });
    await page.evaluate(() => { window.videoIO.cachedPosterUrl = URL.createObjectURL(new Blob(["corrupt WebP"], { type: "image/webp" }));
      window.ProtectedVideoProbe.mount("gs://app/video.mp4", 12, { preferPoster: true, preload: "auto" }); });
    await expect.poll(() => page.evaluate(() => window.videoIO.requests.length)).toBeGreaterThan(0);
    await page.evaluate(() => window.videoIO.resolve("https://signed.test/video.mp4", "https://signed.test/direct.webp"));
    const video = page.getByLabel("Exercise preview"), poster = page.locator("img[data-video-poster]");
    await expect.poll(() => page.evaluate(() => window.videoIO.invalidations)).toBeGreaterThan(0);
    assert.equal(await page.evaluate(() => window.videoIO.cachedPosterUrl), null);
    await expect(poster).toHaveAttribute("src", "https://signed.test/direct.webp");
    await expect.poll(() => poster.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
    assert.equal(imageRequests, 1);
    await expect(page.getByRole("button", { name: "Повторить загрузку превью", exact: true })).toHaveCount(0);
    await expect(video).not.toHaveAttribute("src"); await expect(video).toHaveAttribute("preload", "none");
    assert.equal(await page.evaluate(() => window.videoIO.errors), 0);
    assert.equal(await page.evaluate(() => window.videoIO.signedCalls.every(call => call.options.posterOnly)), true);
  } finally { await browser.close(); }
});

test("failed or corrupt direct poster automatically seeks the chosen frame through a protected video capability", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    for (const status of [404, 403, 200]) {
      const page = await browser.newPage();
      let imageRequests = 0;
      await page.route("https://signed.test/broken.webp", async route => {
        imageRequests++;
        await route.fulfill({ status, contentType: "image/webp", body: "not a valid image" });
      });
      await page.route("https://signed.test/recovered.webp", route => route.fulfill({ contentType: "image/png", body: posterImage }));
      await page.setContent('<main id="root"></main>');
      await page.addScriptTag({ content: generated.output[0].code });
      await page.evaluate(() => window.ProtectedVideoProbe.mount("gs://app/video.mp4", 12, { preferPoster: true, preload: "auto" }));
      await expect.poll(() => page.evaluate(() => window.videoIO.requests.length)).toBeGreaterThan(0);
      await page.evaluate(() => window.videoIO.resolve("https://signed.test/video.mp4", "https://signed.test/broken.webp"));
      const video = page.getByLabel("Exercise preview");
      await expect.poll(() => imageRequests).toBe(1);
      await expect(video).toHaveAttribute("data-video-preview-mode", "seek");
      await expect(video).toHaveAttribute("preload", "metadata");
      assert.equal(imageRequests, 1);
      await expect.poll(() => page.evaluate(() => window.videoIO.requests.length)).toBeGreaterThan(0);
      assert.equal(await page.evaluate(() => window.videoIO.requests.every(request => request.options.posterOnly === undefined)), true);
      await page.evaluate(() => window.videoIO.resolve("https://signed.test/video.mp4", "https://signed.test/broken.webp"));
      await expect(video).toHaveAttribute("src", "https://signed.test/video.mp4");
      await expect(page.locator("img[data-video-poster]")).toHaveCount(0);
      await video.evaluate(node => { node.dispatchEvent(new Event("loadstart")); node.dispatchEvent(new Event("loadedmetadata")); });
      assert.equal(await video.evaluate(node => node.currentTime), 12);
      assert.equal(await video.evaluate(node => node.paused), true);
      assert.equal(await page.evaluate(() => window.videoIO.playCalls), 0);
      await video.evaluate(node => node.play());
      assert.equal(await video.evaluate(node => node.currentTime), 0);
      assert.equal(await page.evaluate(() => window.videoIO.errors), 0, "poster failure must not mark the playable video as failed");
      await page.close();
    }
  } finally { await browser.close(); }
});

test("a newly selected moment without a prebuilt API poster recovers its exact paused frame and first Play starts at zero", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route("https://signed.test/legacy-recovered.webp", route => route.fulfill({ contentType: "image/png", body: posterImage }));
    await page.setContent('<main id="root"></main>');
    await page.addScriptTag({ content: generated.output[0].code });
    await page.evaluate(() => window.ProtectedVideoProbe.mount("gs://app/legacy.mp4", 12, { preferPoster: true, preload: "auto" }));
    const video = page.getByLabel("Exercise preview");
    await expect(video).toHaveAttribute("preload", "none");
    await expect.poll(() => page.evaluate(() => window.videoIO.requests.length)).toBeGreaterThan(0);
    await page.evaluate(() => window.videoIO.resolve("https://signed.test/legacy.mp4", ""));
    await expect(video).toHaveAttribute("preload", "metadata");
    await expect(video).not.toHaveAttribute("poster");
    await expect(video).toHaveAttribute("data-video-preview-mode", "seek");
    await expect.poll(() => page.evaluate(() => window.videoIO.requests.length)).toBeGreaterThan(0);
    assert.equal(await page.evaluate(() => window.videoIO.requests.every(request => request.options.posterOnly === undefined)), true);
    await page.evaluate(() => window.videoIO.resolve("https://signed.test/legacy.mp4"));
    await expect(video).toHaveAttribute("src", "https://signed.test/legacy.mp4");
    await expect(page.getByRole("button", { name: "Повторить загрузку превью", exact: true })).toHaveCount(0);
    await video.evaluate(node => node.dispatchEvent(new Event("loadedmetadata")));
    assert.equal(await video.evaluate(node => node.currentTime), 12);
    assert.equal(await video.evaluate(node => node.paused), true);
    await video.evaluate(node => node.play());
    assert.equal(await video.evaluate(node => node.currentTime), 0);
    await video.evaluate(node => { node.currentTime = 25; node.pause(); node.play(); });
    assert.equal(await video.evaluate(node => node.currentTime), 25, "resuming real playback must not seek to the preview again");
  } finally { await browser.close(); }
});

test("missing-poster fallback does not bypass denied access and a same-UID new session discards its late URL", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<main id="root"></main>');
    await page.addScriptTag({ content: generated.output[0].code });
    await page.evaluate(() => window.ProtectedVideoProbe.mount("gs://app/new-moment.mp4", 7.9, { preferPoster: true }));
    const video = page.getByLabel("Exercise preview");
    await expect.poll(() => page.evaluate(() => window.videoIO.requests.length)).toBeGreaterThan(0);
    await page.evaluate(() => window.videoIO.resolve("", ""));
    await expect(video).toHaveAttribute("data-video-preview-mode", "seek");
    await expect.poll(() => page.evaluate(() => window.videoIO.requests.length)).toBe(1);
    await page.evaluate(() => window.videoIO.reject());
    await expect(page.getByRole("alert")).toContainText("Подпись временно недоступна");
    await expect(video).not.toHaveAttribute("src");
    await page.getByRole("button", { name: "Повторить загрузку", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.videoIO.requests.length)).toBe(1);
    await page.evaluate(() => {
      window.lateFallback = window.videoIO.requests.shift();
      window.videoIO.changeSession();
    });
    await expect.poll(() => page.evaluate(() => window.videoIO.requests.length)).toBeGreaterThan(0);
    await page.evaluate(() => window.lateFallback.resolve({ url: "https://signed.test/old-session.mp4", expiresAt: Date.now() + 40000 }));
    await expect(video).not.toHaveAttribute("src");
    await expect(video).toHaveAttribute("preload", "none");
    assert.equal(await page.evaluate(() => window.videoIO.playCalls), 0);
  } finally { await browser.close(); }
});
