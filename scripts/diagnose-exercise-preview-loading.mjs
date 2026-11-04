// Read-only media diagnosis: selected library videos only, no accounts/history.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { accountToken } from "./exercise-preview-batch.mjs";

const root = resolve("output/playwright/exercise-preview-selection-2026-10-25");
const metadata = JSON.parse(await readFile(resolve(root, "video-metadata.json"), "utf8"));
const candidates = JSON.parse(await readFile(resolve(root, "candidates.json"), "utf8"));
const decisions = JSON.parse(await readFile(resolve(root, "decisions.json"), "utf8"));
const token = await accountToken(), browser = await chromium.launch({ headless: true });
const results = [];
let totalBytes = 0;
try {
  for (const label of ["V001", "V002", "V008"]) {
    const item = metadata.find(item => item.label === label), candidate = candidates.find(item => item.label === label);
    assert.ok(item && candidate && decisions[label]?.choice);
    const time = candidate.times[decisions[label].choice - 1];
    const context = await browser.newContext({ viewport: { width: 402, height: 874 } });
    const controller = new AbortController();
    let bytes = 0, requests = 0;
    try {
      const page = await context.newPage();
      await page.route("https://local-preview-diagnostic.test/video", async route => {
        try {
          const start = Number(/bytes=(\d+)-/.exec(route.request().headers().range || "bytes=0-")?.[1] || 0);
          const end = Math.min(item.size - 1, start + 512 * 1024 - 1);
          requests++;
          const response = await fetch(`https://storage.googleapis.com/storage/v1/b/${item.bucket}/o/${encodeURIComponent(item.objectPath)}?alt=media&generation=${item.generation}`, {
            headers: { Authorization: `Bearer ${token}`, Range: `bytes=${start}-${end}` }, signal: controller.signal
          });
          assert.equal(response.status, 206);
          const body = Buffer.from(await response.arrayBuffer());
          bytes += body.length; totalBytes += body.length;
          assert.ok(totalBytes <= 60 * 1024 * 1024, "Diagnostic byte limit exceeded");
          await route.fulfill({ status: 206, contentType: item.contentType, body,
            headers: { "access-control-allow-origin": "*", "accept-ranges": "bytes", "content-range": `bytes ${start}-${start + body.length - 1}/${item.size}` } });
        } catch { await route.abort().catch(() => {}); }
      });
      await page.setContent('<video preload="auto" muted crossorigin="anonymous" playsinline></video><canvas width="512" height="512"></canvas>');
      const measurement = await page.evaluate(async ({ time, crop }) => {
        const video = document.querySelector("video"), start = performance.now();
        const once = (name, action) => new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("Media diagnostic timeout")), 25000);
          video.addEventListener(name, () => { clearTimeout(timer); resolve(performance.now() - start); }, { once: true });
          video.onerror = () => { clearTimeout(timer); reject(new Error("Media diagnostic decode failed")); };
          action();
        });
        const metadataMs = await once("loadedmetadata", () => { video.src = "https://local-preview-diagnostic.test/video"; video.load(); });
        await once("seeked", () => { video.currentTime = time; });
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const previewMs = performance.now() - start;
        const canvas = document.querySelector("canvas"), ctx = canvas.getContext("2d");
        const scale = crop ? Math.max(512 / video.videoWidth, 512 / video.videoHeight) * crop.zoom : Math.min(512 / video.videoWidth, 512 / video.videoHeight);
        const width = video.videoWidth * scale, height = video.videoHeight * scale;
        ctx.fillStyle = "#1c282e"; ctx.fillRect(0, 0, 512, 512);
        ctx.drawImage(video, (512 - width) * (crop?.x ?? .5), (512 - height) * (crop?.y ?? .5), width, height);
        const image = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", .82));
        return { metadataMs: Math.round(metadataMs), previewMs: Math.round(previewMs), selectedTime: time,
          duration: video.duration, webp512Bytes: image.size, paused: video.paused, readyState: video.readyState };
      }, { time, crop: candidate.crop });
      results.push({ label, names: item.names, sourceBytes: item.size, bytesBeforePreview: bytes, rangeRequestsBeforePreview: requests, ...measurement });
    } finally { controller.abort(); await context.close(); }
  }
} finally { await browser.close(); }
const report = { title: "Диагностика загрузки превью", measuredAt: new Date().toISOString(), version: "3.0.867",
  method: "Изолированный Chromium на компьютере оператора, реальные Range-чтения GCS, preload=auto и перемотка к выбранному кадру; OAuth остаётся в Node.",
  limitations: ["Не измеряет Telegram или телефон пользователя.", "Не включает задержку Firebase-профиля, App Check и создания подписанной ссылки.", "WebP посчитан локально для оценки размера отдельной обложки; ни изображения, ни видео в Production не изменены."],
  results, totalBytes, productionWrites: false };
await mkdir("output/playwright/workout-loading-diagnosis-2026-10-25", { recursive: true });
await writeFile("output/playwright/workout-loading-diagnosis-2026-10-25/media-report.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
