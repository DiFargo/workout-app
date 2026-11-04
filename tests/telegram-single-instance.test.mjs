import assert from "node:assert/strict";
import test from "node:test";
import { acquireTelegramAppInstance } from "../src/app/telegramSingleInstance.js";

const initDataFor = id => new URLSearchParams({ auth_date: "1", user: JSON.stringify({ id }) }).toString();

function lockManager() {
  const active = new Set();
  const calls = [];
  const pending = [];
  return {
    active, calls,
    request(name, options, callback) {
      calls.push({ name, options });
      const request = Promise.resolve().then(async () => {
        if (active.has(name)) return callback(null);
        active.add(name);
        try { return await callback({ name }); }
        finally { active.delete(name); }
      });
      pending.push(request);
      return request;
    },
    drained: () => Promise.all(pending)
  };
}

function host({ manager, id = 123456789, initData = initDataFor(id), hash = "", sdk = true } = {}) {
  const events = new EventTarget();
  return {
    ...(sdk ? { Telegram: { WebApp: { initData } } } : {}),
    location: { hash }, navigator: manager ? { locks: manager } : {},
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
    get localStorage() { assert.fail("single-instance helper must not use localStorage"); },
    get sessionStorage() { assert.fail("single-instance helper must not use sessionStorage"); },
    close() { assert.fail("single-instance helper must not close windows"); }
  };
}

test("primary holds an exclusive non-waiting lock until explicit idempotent release", async () => {
  const manager = lockManager();
  const primary = await acquireTelegramAppInstance(host({ manager }));
  assert.equal(primary.status, "primary");
  assert.equal(manager.active.size, 1);
  assert.deepEqual(manager.calls[0].options, { mode: "exclusive", ifAvailable: true });
  const duplicate = await acquireTelegramAppInstance(host({ manager }));
  assert.equal(duplicate.status, "duplicate");
  duplicate.release();
  assert.equal(manager.active.size, 1, "a duplicate cannot release the primary's lock");
  primary.release();
  primary.release();
  await manager.drained();
  assert.equal(manager.active.size, 0);
  const next = await acquireTelegramAppInstance(host({ manager }));
  assert.equal(next.status, "primary");
  next.release();
  await manager.drained();
});

test("pagehide releases the primary lock without closing the window", async () => {
  const manager = lockManager();
  const primaryWindow = host({ manager });
  const primary = await acquireTelegramAppInstance(primaryWindow);
  assert.equal(primary.status, "primary");
  primaryWindow.dispatchEvent(new Event("pagehide"));
  await manager.drained();
  assert.equal(manager.active.size, 0);
  primary.release();
});

for (const releaseMode of ["explicit", "nonpersisted pagehide"]) {
  test(`persisted pagehide retains ownership until ${releaseMode}`, async () => {
    const manager = lockManager();
    const primaryWindow = host({ manager });
    const primary = await acquireTelegramAppInstance(primaryWindow);
    const cached = new Event("pagehide");
    Object.defineProperty(cached, "persisted", { value: true });
    primaryWindow.dispatchEvent(cached);
    assert.equal(manager.active.size, 1);
    const duplicate = await acquireTelegramAppInstance(host({ manager }));
    assert.equal(duplicate.status, "duplicate", "a cached primary retains its existing workout ownership");
    duplicate.release();
    if (releaseMode === "explicit") primary.release();
    else {
      const leaving = new Event("pagehide");
      Object.defineProperty(leaving, "persisted", { value: false });
      primaryWindow.dispatchEvent(leaving);
    }
    await manager.drained();
    assert.equal(manager.active.size, 0);
    const restored = await acquireTelegramAppInstance(host({ manager }));
    assert.equal(restored.status, "primary");
    restored.release();
    await manager.drained();
  });
}

test("only an explicit null WebLock is classified as duplicate", async () => {
  for (const lock of [null, undefined, false]) {
    const manager = { request: async (_name, _options, callback) => callback(lock) };
    const result = await acquireTelegramAppInstance(host({ manager }));
    assert.equal(result.status, lock === null ? "duplicate" : "unsupported");
    result.release();
  }
});

test("different Telegram accounts do not contend for the same lock", async () => {
  const manager = lockManager();
  const first = await acquireTelegramAppInstance(host({ manager, id: 123456789 }));
  const second = await acquireTelegramAppInstance(host({ manager, id: 987654321 }));
  assert.equal(first.status, "primary");
  assert.equal(second.status, "primary");
  assert.notEqual(manager.calls[0].name, manager.calls[1].name);
  first.release(); second.release();
  await manager.drained();
});

test("SDK and Telegram hash contexts use the same account namespace", async () => {
  const manager = lockManager();
  const primary = await acquireTelegramAppInstance(host({ manager }));
  const fromHash = await acquireTelegramAppInstance(host({ manager, sdk: false, hash: `#tgWebAppData=${encodeURIComponent(initDataFor(123456789))}&tgWebAppVersion=8.0` }));
  assert.equal(fromHash.status, "duplicate");
  primary.release(); fromHash.release();
  await manager.drained();
});

test("a normal browser does not acquire a lock even when an SDK object exists without launch data", async () => {
  const manager = lockManager();
  for (const browser of [host({ manager, sdk: false }), host({ manager, initData: "" })]) {
    const result = await acquireTelegramAppInstance(browser);
    assert.equal(result.status, "browser");
    result.release();
  }
  assert.equal(manager.calls.length, 0);
});

test("a Telegram context with unknown or malformed user ID fails open without a shared global lock", async () => {
  const manager = lockManager();
  for (const initData of ["auth_date=1", "user=not-json", initDataFor(null), initDataFor(-1), initDataFor("not-an-id"), initDataFor(Number.MAX_SAFE_INTEGER + 1)]) {
    const result = await acquireTelegramAppInstance(host({ manager, initData }));
    assert.equal(result.status, "unsupported");
    result.release();
  }
  assert.equal(manager.calls.length, 0);
});

test("an unavailable Web Locks API fails open", async () => {
  const result = await acquireTelegramAppInstance(host());
  assert.equal(result.status, "unsupported");
  result.release();
});

test("synchronous, asynchronous and denied API failures fail open rather than reporting duplicate", async () => {
  for (const request of [
    () => { throw new Error("Synthetic browser rejection"); },
    async () => { throw new Error("Synthetic async rejection"); },
    async () => undefined
  ]) {
    const result = await acquireTelegramAppInstance(host({ manager: { request } }));
    assert.equal(result.status, "unsupported");
    result.release();
  }
  const unavailable = host();
  Object.defineProperty(unavailable.navigator, "locks", { get() { throw new Error("Synthetic permission error"); } });
  assert.equal((await acquireTelegramAppInstance(unavailable)).status, "unsupported");
});
