import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const moduleSource = readFileSync("src/utils/workoutDraftFallbackStorage.js", "utf8");
const origin = "https://workout-draft-fallback.test";
const html = `<script type="module">
  import * as storage from "/storage.js";
  window.storage = storage;
  window.makeDraft = (uid = "client-a", workoutId = "workout-a", revision = 1) => ({
    uid, workoutId, revision, stageIndex: 3, activeSeconds: 417,
    startedAt: new Date("2026-10-31T09:10:11.000Z"),
    savedAt: "2026-10-31T09:17:08.000Z", assignmentVersion: "assignment-v4",
    plan: { workouts: [{ id: workoutId, scheduledDate: "2026-11-01", exercises: [{
      id: "exercise-a", note: "Не терять заметку", video: "protected/video-id",
      videoPoster: "protected/poster-id", videoCrop: { x: 0.4, y: 0.6, scale: 1.2 },
      exerciseCardId: "card-a", exerciseCardOwnerUid: "trainer-a",
      sets: [{ completed: true, enteredWeight: "37.5", enteredReps: "12", weight: 35, reps: 10 }]
    }], taskBlocks: [{ id: "group-a", type: "superset", exerciseIds: ["exercise-a"] }] }] },
    progress: { "exercise-a": { completedSets: [0], notes: "Контроль техники" } }
  });
  window.ready = true;
</script>`;

async function fixture(run) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => {
      const url = route.request().url();
      if (url === `${origin}/`) return route.fulfill({ contentType: "text/html", body: html });
      if (url === `${origin}/storage.js`) return route.fulfill({ contentType: "text/javascript", body: moduleSource });
      return route.abort();
    });
    await page.goto(origin);
    await page.waitForFunction(() => window.ready);
    await run(page);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
}

test("IndexedDB: холодная перезагрузка сохраняет даты, прогресс, подходы и медиа", { timeout: 30000 }, async () => {
  await fixture(async page => {
    const expected = await page.evaluate(async () => {
      const draft = window.makeDraft();
      window.saved = JSON.parse(JSON.stringify(draft));
      const pending = window.storage.writeWorkoutDraftFallback(draft.uid, draft.workoutId, draft);
      draft.progress["exercise-a"].notes = "Изменение после вызова сохранения";
      if (!await pending) throw new Error("Expected committed IndexedDB draft");
      return window.saved;
    });
    await page.reload();
    await page.waitForFunction(() => window.ready);
    assert.deepEqual(await page.evaluate(() => window.storage.readWorkoutDraftFallback("client-a", "workout-a")), expected);
    assert.deepEqual(await page.evaluate(() => window.storage.readWorkoutDraftFallbackResult("client-a", "workout-a")),
      { available: true, draft: expected });
    assert.deepEqual(await page.evaluate(() => window.storage.listWorkoutDraftFallbacks("client-a")), [expected]);
  });
});

test("IndexedDB: успешное чтение отсутствующей записи отличается от недоступного хранилища", { timeout: 30000 }, async () => {
  await fixture(async page => {
    assert.deepEqual(await page.evaluate(() => window.storage.readWorkoutDraftFallbackResult("client-a", "missing")),
      { available: true, draft: null });
    assert.equal(await page.evaluate(() => window.storage.readWorkoutDraftFallback("client-a", "missing")), null);
  });
});

test("IndexedDB: вне браузера отсутствие browser storage сохраняет совместимость legacy runtime", async () => {
  const { readWorkoutDraftFallbackResult } = await import("../src/utils/workoutDraftFallbackStorage.js");
  assert.deepEqual(await readWorkoutDraftFallbackResult("client-a", "missing"), { available: true, draft: null });
});

test("IndexedDB: UID изолированы, составные ключи не пересекаются, clear удаляет только свою запись", { timeout: 30000 }, async () => {
  await fixture(async page => {
    const result = await page.evaluate(async () => {
      const api = window.storage;
      const first = window.makeDraft("client:a", "b");
      const second = window.makeDraft("client", "a:b", 2);
      const writes = await Promise.all([
        api.writeWorkoutDraftFallback(first.uid, first.workoutId, first),
        api.writeWorkoutDraftFallback(second.uid, second.workoutId, second)
      ]);
      const before = await api.listWorkoutDraftFallbacks("client");
      const foreign = await api.readWorkoutDraftFallback("unrelated", "a:b");
      const removed = await api.clearWorkoutDraftFallback(first.uid, first.workoutId);
      return { writes, before, foreign, removed, own: await api.listWorkoutDraftFallbacks(first.uid),
        other: await api.readWorkoutDraftFallback(second.uid, second.workoutId) };
    });
    assert.deepEqual(result.writes, [true, true]);
    assert.equal(result.foreign, null);
    assert.equal(result.removed, true);
    assert.deepEqual(result.own, []);
    assert.equal(result.before.length, 1);
    assert.equal(result.other.uid, "client");
    assert.equal(result.other.revision, 2);
  });
});

test("IndexedDB: конкурентные записи упорядочены, последующий clear не даёт воскреснуть старому черновику", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await page.evaluate(() => {
      const nativeOpen = IDBFactory.prototype.open;
      IDBFactory.prototype.open = function (...args) {
        const actual = nativeOpen.apply(this, args);
        const delayed = {};
        actual.onupgradeneeded = () => {
          delayed.result = actual.result;
          delayed.transaction = actual.transaction;
          delayed.onupgradeneeded?.();
        };
        actual.onerror = () => delayed.onerror?.();
        actual.onsuccess = () => {
          delayed.result = actual.result;
          window.releaseOpen = () => delayed.onsuccess?.();
        };
        return delayed;
      };
      const api = window.storage;
      window.pendingOperations = [
        api.writeWorkoutDraftFallback("client-a", "workout-a", window.makeDraft("client-a", "workout-a", 1)),
        api.writeWorkoutDraftFallback("client-a", "workout-a", window.makeDraft("client-a", "workout-a", 2)),
        api.clearWorkoutDraftFallback("client-a", "workout-a"),
        api.readWorkoutDraftFallback("client-a", "workout-a"),
        api.listWorkoutDraftFallbacks("client-a")
      ];
    });
    await page.waitForFunction(() => window.releaseOpen);
    await page.evaluate(() => window.releaseOpen());
    assert.deepEqual(await page.evaluate(() => Promise.all(window.pendingOperations)), [true, true, true, null, []]);
    await page.reload();
    await page.waitForFunction(() => window.ready);
    assert.equal(await page.evaluate(() => window.storage.readWorkoutDraftFallback("client-a", "workout-a")), null);
    assert.equal(await page.evaluate(async () => {
      const api = window.storage;
      const writes = [1, 2, 3].map(revision => api.writeWorkoutDraftFallback("client-a", "workout-a", window.makeDraft("client-a", "workout-a", revision)));
      const draft = await api.readWorkoutDraftFallback("client-a", "workout-a");
      await Promise.all(writes);
      return draft.revision;
    }), 3);
  });
});

test("IndexedDB: list ждёт уже вызванные записи всех тренировок только выбранного UID", { timeout: 30000 }, async () => {
  await fixture(async page => {
    const result = await page.evaluate(async () => {
      const api = window.storage;
      const writes = [
        api.writeWorkoutDraftFallback("client-a", "one", window.makeDraft("client-a", "one")),
        api.writeWorkoutDraftFallback("client-a", "two", window.makeDraft("client-a", "two")),
        api.writeWorkoutDraftFallback("client-b", "other", window.makeDraft("client-b", "other"))
      ];
      const listed = await api.listWorkoutDraftFallbacks("client-a");
      return { writes: await Promise.all(writes), ids: listed.map(draft => draft.workoutId).sort() };
    });
    assert.deepEqual(result, { writes: [true, true, true], ids: ["one", "two"] });
  });
});

test("IndexedDB: недоступное хранилище и ошибка open безопасны, следующий вызов повторяет открытие", { timeout: 30000 }, async () => {
  await fixture(async page => {
    const result = await page.evaluate(async () => {
      const api = window.storage;
      const nativeFactory = window.indexedDB;
      Object.defineProperty(window, "indexedDB", { configurable: true, get() { throw new DOMException("Denied", "SecurityError"); } });
      const denied = await Promise.all([
        api.writeWorkoutDraftFallback("client-a", "workout-a", window.makeDraft()),
        api.readWorkoutDraftFallback("client-a", "workout-a"),
        api.listWorkoutDraftFallbacks("client-a"),
        api.clearWorkoutDraftFallback("client-a", "workout-a"),
        api.readWorkoutDraftFallbackResult("client-a", "workout-a")
      ]);
      Object.defineProperty(window, "indexedDB", { configurable: true, value: undefined });
      const unavailable = await api.writeWorkoutDraftFallback("client-a", "workout-a", window.makeDraft());
      const unavailableRead = await api.readWorkoutDraftFallbackResult("client-a", "workout-a");
      Object.defineProperty(window, "indexedDB", { configurable: true, value: { open() {
        const request = {};
        queueMicrotask(() => request.onerror?.());
        return request;
      } } });
      const openError = await api.writeWorkoutDraftFallback("client-a", "workout-a", window.makeDraft());
      const openErrorRead = await api.readWorkoutDraftFallbackResult("client-a", "workout-a");
      Object.defineProperty(window, "indexedDB", { configurable: true, value: nativeFactory });
      const recovered = await api.writeWorkoutDraftFallback("client-a", "workout-a", window.makeDraft());
      return { denied, unavailable, unavailableRead, openError, openErrorRead, recovered };
    });
    const failedRead = { available: false, draft: null };
    assert.deepEqual(result, { denied: [false, null, [], false, failedRead], unavailable: false, unavailableRead: failedRead,
      openError: false, openErrorRead: failedRead, recovered: true });
  });
});

test("IndexedDB: timeout open сбрасывает попытку, позднее соединение закрывается, повтор работает", { timeout: 30000 }, async () => {
  await fixture(async page => {
    await page.clock.install();
    await page.evaluate(() => {
      const nativeFactory = window.indexedDB;
      window.restoreIndexedDB = () => Object.defineProperty(window, "indexedDB", { configurable: true, value: nativeFactory });
      Object.defineProperty(window, "indexedDB", { configurable: true, value: { open() {
        return window.delayedRequest = {};
      } } });
      window.delayedWrite = window.storage.writeWorkoutDraftFallback("client-a", "workout-a", window.makeDraft());
      window.delayedReadResult = window.storage.readWorkoutDraftFallbackResult("client-a", "missing");
    });
    await page.waitForFunction(() => window.delayedRequest);
    await page.clock.runFor(4100);
    assert.equal(await page.evaluate(() => window.delayedWrite), false);
    assert.deepEqual(await page.evaluate(() => window.delayedReadResult), { available: false, draft: null });
    const result = await page.evaluate(async () => {
      window.restoreIndexedDB();
      const recovered = await window.storage.writeWorkoutDraftFallback("client-a", "workout-a", window.makeDraft());
      let lateClosed = 0;
      window.delayedRequest.result = { close() { lateClosed++; } };
      window.delayedRequest.onsuccess();
      return { recovered, lateClosed, revision: (await window.storage.readWorkoutDraftFallback("client-a", "workout-a")).revision };
    });
    assert.deepEqual(result, { recovered: true, lateClosed: 1, revision: 1 });
  });
});

test("IndexedDB: quota и abort после success не подтверждают запись; очередь восстанавливается", { timeout: 30000 }, async () => {
  await fixture(async page => {
    const result = await page.evaluate(async () => {
      const api = window.storage;
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function () { throw new DOMException("Full", "QuotaExceededError"); };
      const quota = await api.writeWorkoutDraftFallback("client-a", "workout-a", window.makeDraft());
      IDBObjectStore.prototype.put = function (...args) {
        const request = put.apply(this, args);
        request.addEventListener("success", () => this.transaction.abort());
        return request;
      };
      const aborted = await api.writeWorkoutDraftFallback("client-a", "workout-a", window.makeDraft());
      const missing = await api.readWorkoutDraftFallback("client-a", "workout-a");
      IDBObjectStore.prototype.put = put;
      const recovered = await api.writeWorkoutDraftFallback("client-a", "workout-a", window.makeDraft());
      return { quota, aborted, missing, recovered };
    });
    assert.deepEqual(result, { quota: false, aborted: false, missing: null, recovered: true });
  });
});

test("IndexedDB: неверный владелец, повреждённый JSON и несериализуемый payload не читаются и не записываются", { timeout: 30000 }, async () => {
  await fixture(async page => {
    const result = await page.evaluate(async () => {
      const api = window.storage;
      const cycle = window.makeDraft();
      cycle.self = cycle;
      const bigint = { ...window.makeDraft(), invalid: 1n };
      const customJson = { ...window.makeDraft(), toJSON() { return { uid: "other", workoutId: "workout-a" }; } };
      const rejected = await Promise.all([
        api.writeWorkoutDraftFallback("client-a", "workout-a", window.makeDraft("other")),
        api.writeWorkoutDraftFallback("client-a", "workout-a", window.makeDraft("client-a", "other")),
        api.writeWorkoutDraftFallback("client-a", "workout-a", cycle),
        api.writeWorkoutDraftFallback("client-a", "workout-a", bigint),
        api.writeWorkoutDraftFallback("client-a", "workout-a", customJson),
        api.writeWorkoutDraftFallback("", "workout-a", window.makeDraft())
      ]);
      await api.writeWorkoutDraftFallback("client-a", "valid", window.makeDraft("client-a", "valid"));
      await new Promise((resolve, reject) => {
        const request = indexedDB.open("ownset-workout-draft-fallback-v1", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const connection = request.result;
          const transaction = connection.transaction("drafts", "readwrite");
          const store = transaction.objectStore("drafts");
          for (const [workoutId, payload] of [
            ["workout-a", JSON.stringify(window.makeDraft("other"))],
            ["bad-json", "{"],
            ["wrong-workout", JSON.stringify(window.makeDraft())]
          ]) store.put({ key: JSON.stringify(["client-a", workoutId]), uid: "client-a", workoutId, payload });
          store.put({ key: "unscoped", uid: "client-a", workoutId: "unscoped", payload: JSON.stringify(window.makeDraft("client-a", "unscoped")) });
          transaction.oncomplete = () => { connection.close(); resolve(); };
          transaction.onabort = () => { connection.close(); reject(transaction.error); };
        };
      });
      return { rejected, corrupted: await api.readWorkoutDraftFallback("client-a", "workout-a"),
        listed: (await api.listWorkoutDraftFallbacks("client-a")).map(draft => draft.workoutId) };
    });
    assert.deepEqual(result, { rejected: [false, false, false, false, false, false], corrupted: null, listed: ["valid"] });
  });
});
