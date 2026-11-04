import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { accountToken } from "./exercise-preview-batch.mjs";

const directory = resolve("output/playwright/exercise-preview-selection-2026-10-25");
const inventory = JSON.parse(await readFile(resolve(directory, "inventory.json"), "utf8"));
const requestedLabels = process.argv.find(argument => argument.startsWith("--labels="))?.slice(9).split(",") || [];
const cache = resolve(directory, "private-video-cache");
await mkdir(cache, { recursive: true });
const token = await accountToken();
let totalBytes = 0;
const downloaded = [];
let next = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  for (;;) {
    const video = inventory.videos[next++];
    if (!video) return;
    const response = await fetch(`https://storage.googleapis.com/storage/v1/b/${video.bucket}/o/${encodeURIComponent(video.objectPath)}?fields=size,md5Hash,contentType,generation`, {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(25000)
    });
    if (response.status !== 200) { downloaded.push({ ...video, error: `HTTP ${response.status}` }); continue; }
    const metadata = await response.json();
    assert.ok(/^video\//.test(metadata.contentType || ""), "Only exercise videos allowed");
    downloaded.push({ ...video, size: Number(metadata.size), contentType: metadata.contentType, generation: metadata.generation, sha256: metadata.md5Hash });
  }
}));
const groups = [];
for (const video of downloaded.sort((a, b) => a.label.localeCompare(b.label))) {
  if (video.error) { groups.push({ ...video, videos: [video.label] }); continue; }
  const crop = inventory.entries.find(entry => entry.videoKey === video.key)?.crop || null;
  const identity = JSON.stringify([video.sha256, crop]);
  const same = groups.find(group => group.identity === identity);
  if (same) { same.videos.push(video.label); same.names = [...new Set([...same.names, ...video.names])]; }
  else groups.push({ ...video, videos: [video.label], crop, identity });
}
console.log(JSON.stringify({ metadata: downloaded.length, uniqueContentAndCrop: groups.length, fullMegabytes: Math.round(downloaded.reduce((sum, video) => sum + (video.size || 0), 0) / 1024 / 1024), maximumMegabytes: Math.round(Math.max(...downloaded.map(video => video.size || 0)) / 1024 / 1024) }));
await writeFile(resolve(directory, "video-metadata.json"), JSON.stringify(groups, null, 2) + "\n");
const activeGroups = requestedLabels.length ? groups.filter(group => group.videos.some(label => requestedLabels.includes(label))) : groups;
const browser = await chromium.launch({ headless: true });
const candidates = [];
try {
  next = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    const page = await browser.newPage();
    try {
      await page.route("https://local-preview.test/**", async route => {
        const key = new URL(route.request().url()).pathname.slice(1);
        const video = downloaded.find(video => video.key === key && !video.error);
        if (!video) return route.abort();
        const requested = /bytes=(\d+)-/.exec(route.request().headers().range || "bytes=0-");
        const start = Number(requested?.[1] || 0);
        const end = Math.min(video.size - 1, start + 512 * 1024 - 1);
        const response = await fetch(`https://storage.googleapis.com/storage/v1/b/${video.bucket}/o/${encodeURIComponent(video.objectPath)}?alt=media&generation=${video.generation}`, {
          headers: { Authorization: `Bearer ${token}`, Range: `bytes=${start}-${end}` }, signal: AbortSignal.timeout(25000)
        });
        if (response.status !== 206) return route.abort();
        const bytes = Buffer.from(await response.arrayBuffer());
        totalBytes += bytes.length;
        assert.ok(totalBytes < 650 * 1024 * 1024, "Bounded streamed preview budget exceeded");
        await route.fulfill({ status: 206, contentType: video.contentType,
          headers: { "access-control-allow-origin": "*", "accept-ranges": "bytes", "content-range": `bytes ${start}-${start + bytes.length - 1}/${video.size}` }, body: bytes });
      });
      await page.setContent('<canvas></canvas><video muted crossorigin="anonymous"></video>');
      for (;;) {
        const group = activeGroups[next++];
        if (!group) break;
        if (group.error) { candidates.push(group); continue; }
        try {
          const result = await page.evaluate(async ({ key, crop, dense }) => {
            const video = document.querySelector("video");
            const canvas = document.querySelector("canvas");
            canvas.width = 1200; canvas.height = 230;
            const ctx = canvas.getContext("2d");
            const wait = (event, action) => new Promise((resolve, reject) => {
              const timer = setTimeout(() => reject(Error(`Video ${event} timeout`)), 18000);
              video.addEventListener(event, () => { clearTimeout(timer); resolve(); }, { once: true });
              video.onerror = () => { clearTimeout(timer); reject(Error("Video decode failed")); };
              action();
            });
            await wait("loadeddata", () => { video.src = `https://local-preview.test/${key}`; video.load(); });
            const fractions = dense ? [.04, .07, .10, .13, .16, .19] : [.12, .27, .42, .57, .72, .87];
            const times = fractions.map(fraction => Math.round(video.duration * fraction * 1000) / 1000);
            for (let index = 0; index < times.length; index++) {
              await wait("seeked", () => { video.currentTime = times[index]; });
              await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
              const x = index * 200;
              ctx.fillStyle = "#1c282e"; ctx.fillRect(x, 0, 200, 200);
              const scale = (crop ? Math.max(200 / video.videoWidth, 200 / video.videoHeight) * crop.zoom : Math.min(200 / video.videoWidth, 200 / video.videoHeight));
              const width = video.videoWidth * scale, height = video.videoHeight * scale;
              ctx.save(); ctx.beginPath(); ctx.rect(x, 0, 200, 200); ctx.clip();
              ctx.drawImage(video, x + (200 - width) * (crop?.x ?? .5), (200 - height) * (crop?.y ?? .5), width, height);
              ctx.restore(); ctx.fillStyle = "#fff"; ctx.fillRect(x, 200, 200, 30);
              ctx.fillStyle = "#1c1c1e"; ctx.font = "16px Arial"; ctx.fillText(`${index + 1}: ${times[index].toFixed(2)} s`, x + 8, 220);
            }
            return { duration: video.duration, width: video.videoWidth, height: video.videoHeight, times, png: canvas.toDataURL("image/png").split(",")[1] };
          }, { key: group.key, crop: group.crop, dense: requestedLabels.length > 0 });
          await writeFile(resolve(directory, `${group.label}-candidates.png`), Buffer.from(result.png, "base64"));
          delete result.png;
          candidates.push({ label: group.label, names: group.names, videos: group.videos, key: group.key, crop: group.crop, contentMd5: group.sha256, ...result });
        } catch (error) { candidates.push({ label: group.label, names: group.names, videos: group.videos, error: error.message }); }
      }
    } finally { await page.close(); }
  }));
  if (requestedLabels.length) {
    const previous = JSON.parse(await readFile(resolve(directory, "candidates.json"), "utf8"));
    candidates.push(...previous.filter(item => !candidates.some(candidate => candidate.label === item.label)));
  }
  candidates.forEach(candidate => {
    if (candidate.sha256) { candidate.contentMd5 = candidate.sha256; delete candidate.sha256; }
  });
  candidates.sort((a, b) => a.label.localeCompare(b.label));
  await writeFile(resolve(directory, "candidates.json"), JSON.stringify(candidates, null, 2) + "\n");
  const page = await browser.newPage({ viewport: { width: 1200, height: 1900 } });
  await page.route("https://local-candidate.test/**", async route => route.fulfill({ contentType: "image/png", body: await readFile(resolve(directory, new URL(route.request().url()).pathname.slice(1))) }));
  const successful = candidates.filter(candidate => !candidate.error);
  for (let index = 0; index < successful.length; index += 6) {
    const rows = successful.slice(index, index + 6);
    await page.setContent(`<body style="margin:0;background:white;font-family:Arial">${rows.map(row => `<div style="height:300px"><div style="height:64px;font-size:19px;padding:5px;box-sizing:border-box">${row.label} · ${row.names.join(" / ").replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</div><img width="1200" height="230" src="https://local-candidate.test/${row.label}-candidates.png"></div>`).join("")}</body>`);
    await page.locator("img").last().waitFor({ state: "visible" });
    await page.evaluate(() => Promise.all([...document.images].map(image => image.decode())));
    await page.screenshot({ path: resolve(directory, `sheet-${String(index / 6 + 1).padStart(2, "0")}.png`), fullPage: true });
  }
  console.log(JSON.stringify({ candidates: candidates.length, streamedMegabytes: Math.round(totalBytes / 1024 / 1024), failed: candidates.filter(candidate => candidate.error).map(({ label, error }) => ({ label, error })), sheets: Math.ceil(successful.length / 6) }));
} finally { await browser.close(); }
