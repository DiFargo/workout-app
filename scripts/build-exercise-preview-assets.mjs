import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { accountToken, inventory, readCatalog } from "./exercise-preview-batch.mjs";
import { EXERCISE_VIDEO_PREVIEW_MAX_BYTES, EXERCISE_VIDEO_PREVIEW_PRIVATE_CACHE, resolveExerciseVideoPreviewAssetPath } from "../functions/exerciseVideoPreviewAsset.js";
import { resolveProtectedExerciseVideoSource } from "../functions/protectedExerciseVideo.js";

const copiedOnly = process.argv.includes("--copied-only");
const directory = resolve(copiedOnly ? "output/playwright/copied-exercise-preview-repair" : "output/playwright/exercise-preview-assets-3.0.868");
const bucket = "tren-85720.firebasestorage.app";
const hash = bytes => createHash("md5").update(bytes).digest("base64");
const metadataUrl = path => `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(path)}`;
const token = await accountToken();
await mkdir(directory, { recursive: true });

if (process.argv.includes("--prepare")) {
  const rawCatalog = await readCatalog(token);
  const copiedOwners = new Set(rawCatalog.trainerExerciseCards.filter(card => card.copiedFrom?.operation === "trainer-library-copy-v1").map(card => card.ownerUid));
  const catalog = inventory(rawCatalog);
  const jobs = [];
  for (const entry of catalog.entries) {
    if (!entry.videoRef || !Number.isFinite(entry.posterTime) || entry.hasCustomPoster) continue;
    if (copiedOnly && !copiedOwners.has(entry.ownerUid)) continue;
    const video = catalog.videos.find(video => video.key === entry.videoKey);
    assert.equal(video.bucket, bucket);
    const objectPath = resolveExerciseVideoPreviewAssetPath({ ...video, previewTime: entry.posterTime });
    if (copiedOnly) {
      const existing = await fetch(metadataUrl(objectPath), { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
      assert.ok([200, 404].includes(existing.status));
      if (existing.status === 200) continue;
    }
    if (!jobs.some(job => job.objectPath === objectPath)) jobs.push({ objectPath, video, previewTime: entry.posterTime, names: [entry.name] });
  }
  assert.ok(jobs.length > 0 && jobs.length <= 140, "Bounded current-library poster preparation");
  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (;;) {
      const job = jobs[next++]; if (!job) return;
      const response = await fetch(metadataUrl(job.video.objectPath) + "?fields=size,md5Hash,contentType,generation", {
        headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000)
      });
      assert.equal(response.status, 200);
      job.source = await response.json();
      assert.ok(/^video\//.test(job.source.contentType));
    }
  }));
  const groups = [];
  for (const job of jobs) {
    const identity = JSON.stringify([job.source.md5Hash, job.previewTime]);
    const existing = groups.find(group => group.identity === identity);
    if (existing) existing.jobs.push(job);
    else groups.push({ identity, jobs: [job] });
  }
  const browser = await chromium.launch({ headless: true });
  let streamedBytes = 0;
  const assets = [];
  try {
    next = 0;
    await Promise.all(Array.from({ length: 3 }, async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      let activeJob;
      try {
        await page.route("https://private-poster-builder.test/video*", async route => {
          try {
            const job = activeJob;
            const start = Number(/bytes=(\d+)-/.exec(route.request().headers().range || "bytes=0-")?.[1] || 0);
            const end = Math.min(Number(job.source.size) - 1, start + 512 * 1024 - 1);
            const response = await fetch(metadataUrl(job.video.objectPath) + `?alt=media&generation=${job.source.generation}`, {
              headers: { Authorization: `Bearer ${token}`, Range: `bytes=${start}-${end}` }, signal: AbortSignal.timeout(20000)
            });
            assert.equal(response.status, 206);
            const body = Buffer.from(await response.arrayBuffer()); streamedBytes += body.length;
            assert.ok(streamedBytes <= 650 * 1024 * 1024, "Bounded source streaming budget exceeded");
            await route.fulfill({ status: 206, contentType: job.source.contentType, body,
              headers: { "access-control-allow-origin": "*", "accept-ranges": "bytes", "content-range": `bytes ${start}-${start + body.length - 1}/${job.source.size}` } });
          } catch { await route.abort().catch(() => {}); }
        });
        for (;;) {
          const group = groups[next++]; if (!group) break;
          activeJob = group.jobs[0];
          await page.setContent('<video preload="metadata" muted crossorigin="anonymous"></video><canvas></canvas>');
          const image = await page.evaluate(async ({ time }) => {
            const video = document.querySelector("video"), canvas = document.querySelector("canvas");
            const event = (name, action) => new Promise((resolve, reject) => {
              const timeout = setTimeout(() => reject(Error("Poster decode timeout")), 20000);
              video.addEventListener(name, () => { clearTimeout(timeout); resolve(); }, { once: true });
              video.onerror = () => { clearTimeout(timeout); reject(Error("Poster decode error")); };
              action();
            });
            await event("loadeddata", () => { video.src = "https://private-poster-builder.test/video?" + Math.random(); video.load(); });
            const chosenTime = Math.min(time, Math.max(0, video.duration - .05));
            await event("seeked", () => { video.currentTime = chosenTime; });
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
            canvas.width = Math.max(1, Math.round(video.videoWidth * scale)); canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
            canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
            return { png: canvas.toDataURL("image/webp", .82).split(",")[1], width: canvas.width, height: canvas.height, chosenTime };
          }, { time: activeJob.previewTime });
          const bytes = Buffer.from(image.png, "base64"); delete image.png;
          assert.ok(bytes.length > 0 && bytes.length <= EXERCISE_VIDEO_PREVIEW_MAX_BYTES);
          for (const job of group.jobs) {
            const filename = job.objectPath.split("/").at(-1);
            await writeFile(resolve(directory, filename), bytes);
            assets.push({ objectPath: job.objectPath, filename, sourceRef: `gs://${bucket}/${job.video.objectPath}`,
              sourceGeneration: job.source.generation, previewTime: job.previewTime, names: job.names,
              bytes: bytes.length, md5Hash: hash(bytes), ...image });
          }
          console.log(JSON.stringify({ prepared: assets.length, total: jobs.length }));
        }
      } finally { await context.close(); }
    }));
  } finally { await browser.close(); }
  assert.equal(assets.length, jobs.length);
  await writeFile(resolve(directory, "manifest.json"), JSON.stringify({ project: "tren-85720", bucket,
    generatedAt: new Date().toISOString(), sourceLibraryCapturedAt: catalog.capturedAt, assets, streamedBytes }, null, 2) + "\n");
  console.log(JSON.stringify({ prepared: assets.length, totalPosterBytes: assets.reduce((sum, asset) => sum + asset.bytes, 0), streamedBytes, productionWrites: false }));
} else if (process.argv.includes("--upload")) {
  assert.ok(process.argv.includes("--project=tren-85720"), "Explicit production project required");
  const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8"));
  assert.equal(manifest.bucket, bucket); assert.ok(manifest.assets.length <= 140);
  const result = { project: "tren-85720", bucket, startedAt: new Date().toISOString(), uploaded: [], existing: [] };
  for (const asset of manifest.assets) {
    assert.ok(/^protected-exercise-previews\/v1\/[a-f0-9]{64}\.webp$/.test(asset.objectPath));
    assert.equal(asset.filename, asset.objectPath.split("/").at(-1));
    if (copiedOnly) {
      const source = resolveProtectedExerciseVideoSource(asset.sourceRef, bucket);
      assert.equal(resolveExerciseVideoPreviewAssetPath({ ...source, previewTime: asset.previewTime }), asset.objectPath);
      const metadata = await fetch(metadataUrl(source.objectPath), { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
      assert.equal(metadata.status, 200);
      assert.equal((await metadata.json()).generation, asset.sourceGeneration, "Video changed after preview preparation; prepare again");
    }
    const bytes = await readFile(resolve(directory, asset.filename));
    assert.equal(hash(bytes), asset.md5Hash); assert.ok(bytes.length <= EXERCISE_VIDEO_PREVIEW_MAX_BYTES);
    const current = await fetch(metadataUrl(asset.objectPath), { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
    assert.ok([200, 404].includes(current.status));
    if (current.status === 404) {
      const boundary = "exercise-preview-" + createHash("sha256").update(asset.objectPath).digest("hex").slice(0, 24);
      const metadata = { name: asset.objectPath, contentType: "image/webp", cacheControl: EXERCISE_VIDEO_PREVIEW_PRIVATE_CACHE, contentDisposition: "inline" };
      const body = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: image/webp\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--\r\n`)]);
      const uploaded = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=multipart&ifGenerationMatch=0`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body, signal: AbortSignal.timeout(30000)
      });
      assert.equal(uploaded.status, 200, "Private poster create failed; inspect before retry");
      result.uploaded.push(asset.objectPath);
    } else result.existing.push(asset.objectPath);
    const verified = await fetch(metadataUrl(asset.objectPath), { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
    assert.equal(verified.status, 200);
    const saved = await verified.json();
    assert.equal(saved.md5Hash, asset.md5Hash); assert.equal(saved.contentType, "image/webp");
    assert.equal(saved.cacheControl, EXERCISE_VIDEO_PREVIEW_PRIVATE_CACHE); assert.ok(!saved.metadata?.firebaseStorageDownloadTokens);
    await writeFile(resolve(directory, "upload-result.json"), JSON.stringify(result, null, 2) + "\n");
  }
  result.completedAt = new Date().toISOString();
  await writeFile(resolve(directory, "upload-result.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ verified: result.uploaded.length + result.existing.length, uploaded: result.uploaded.length, existing: result.existing.length, publicTokens: false, videoOrFirestoreWrites: false }));
} else throw new Error("Use --prepare or --upload --project=tren-85720");
