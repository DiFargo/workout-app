const DATABASE_NAME = "ownset-workout-draft-fallback-v1";
const STORE_NAME = "drafts";
const STORAGE_TIMEOUT_MS = 4000;

let database = null;
let opening = null;
const operations = new Map();

function validScope(uid, workoutId) {
  return typeof uid === "string" && uid.trim().length > 0 && (
    (typeof workoutId === "string" && workoutId.length > 0) ||
    (typeof workoutId === "number" && Number.isFinite(workoutId))
  );
}

function ownsDraft(draft, uid, workoutId) {
  return draft && typeof draft === "object" && !Array.isArray(draft) &&
    draft.uid === uid && draft.workoutId === workoutId;
}

function storageKey(uid, workoutId) {
  return JSON.stringify([uid, workoutId]);
}

function closeDatabase(connection) {
  if (database === connection) database = null;
  try { connection?.close(); } catch { /* Storage may have become unavailable. */ }
}

function openDatabase() {
  if (database) return Promise.resolve(database);
  if (opening) return opening;

  let resolveOpen;
  const pending = new Promise(resolve => { resolveOpen = resolve; });
  opening = pending;
  let settled = false;
  let timeout;
  const finish = connection => {
    if (settled) {
      if (connection) closeDatabase(connection);
      return;
    }
    settled = true;
    clearTimeout(timeout);
    if (opening === pending) opening = null;
    if (connection) database = connection;
    resolveOpen(connection);
  };

  try {
    const factory = globalThis.indexedDB;
    if (!factory) {
      finish(null);
      return pending;
    }
    const request = factory.open(DATABASE_NAME, 1);
    timeout = setTimeout(() => finish(null), STORAGE_TIMEOUT_MS);
    request.onupgradeneeded = () => {
      try {
        if (settled) {
          request.transaction?.abort();
          return;
        }
        const store = request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("uid", "uid", { unique: false });
      } catch {
        try { request.transaction?.abort(); } catch { /* Already aborted. */ }
        finish(null);
      }
    };
    request.onsuccess = () => {
      const connection = request.result;
      connection.onversionchange = () => closeDatabase(connection);
      connection.onclose = () => { if (database === connection) database = null; };
      finish(connection);
    };
    request.onerror = () => finish(null);
    request.onblocked = () => finish(null);
  } catch {
    finish(null);
  }
  return pending;
}

async function transact(mode, requestFor, resultFor, fallback) {
  const connection = await openDatabase();
  if (!connection) return fallback;

  return new Promise(resolve => {
    let transaction;
    let timeout;
    let settled = false;
    let failed = false;
    let result = fallback;
    const finish = value => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(value);
    };
    try {
      transaction = connection.transaction(STORE_NAME, mode);
      transaction.oncomplete = () => finish(failed ? fallback : result);
      transaction.onabort = () => finish(fallback);
      transaction.onerror = () => { failed = true; };
      timeout = setTimeout(() => {
        try { transaction.abort(); } catch { /* It may have completed already. */ }
        closeDatabase(connection);
        finish(fallback);
      }, STORAGE_TIMEOUT_MS);
      const request = requestFor(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => {
        try { result = resultFor(request.result); } catch { failed = true; }
      };
      request.onerror = () => { failed = true; };
    } catch {
      try { transaction?.abort(); } catch { /* No active transaction remains. */ }
      closeDatabase(connection);
      finish(fallback);
    }
  });
}

function enqueue(uid, workoutId, operation, fallback) {
  const key = storageKey(uid, workoutId);
  const previous = operations.get(key)?.pending || Promise.resolve();
  // Both successful and failed operations release the next operation. In
  // particular, a delayed write must settle before a later delete can commit.
  const pending = previous.catch(() => {}).then(operation).catch(() => fallback);
  operations.set(key, { uid, pending });
  void pending.then(() => {
    if (operations.get(key)?.pending === pending) operations.delete(key);
  });
  return pending;
}

function readRecord(record, uid, workoutId = record?.workoutId) {
  try {
    if (!validScope(uid, workoutId) || record?.uid !== uid || record.workoutId !== workoutId ||
      record.key !== storageKey(uid, workoutId) || typeof record.payload !== "string") return null;
    const draft = JSON.parse(record.payload);
    return ownsDraft(draft, uid, workoutId) ? draft : null;
  } catch {
    return null;
  }
}

export async function writeWorkoutDraftFallback(uid, workoutId, draft) {
  let payload;
  try {
    if (!validScope(uid, workoutId) || !ownsDraft(draft, uid, workoutId)) return false;
    payload = JSON.stringify(draft);
    // A custom toJSON must not remove or change the ownership envelope.
    if (!ownsDraft(JSON.parse(payload), uid, workoutId)) return false;
  } catch {
    return false;
  }
  const record = { key: storageKey(uid, workoutId), uid, workoutId, payload };
  return enqueue(uid, workoutId, () => transact("readwrite", store => store.put(record), () => true, false), false);
}

export async function readWorkoutDraftFallbackResult(uid, workoutId) {
  const unavailable = { available: false, draft: null };
  if (!validScope(uid, workoutId)) return { available: true, draft: null };
  try {
    // SSR and the non-browser legacy runtime have no durable browser store.
    // In a browser, however, an unavailable store is not an absent draft.
    if (typeof window === "undefined" && !globalThis.indexedDB) return { available: true, draft: null };
  } catch {
    return unavailable;
  }
  return enqueue(uid, workoutId, () => transact("readonly", store => store.get(storageKey(uid, workoutId)),
    record => ({ available: true, draft: readRecord(record, uid, workoutId) }), unavailable), unavailable);
}

export async function readWorkoutDraftFallback(uid, workoutId) {
  return (await readWorkoutDraftFallbackResult(uid, workoutId)).draft;
}

export async function listWorkoutDraftFallbacks(uid) {
  if (typeof uid !== "string" || !uid.trim()) return [];
  try {
    await Promise.all([...operations.values()].filter(operation => operation.uid === uid).map(operation => operation.pending));
    return await transact("readonly", store => store.index("uid").getAll(uid),
      records => records.map(record => readRecord(record, uid)).filter(Boolean), []);
  } catch {
    return [];
  }
}

export async function clearWorkoutDraftFallback(uid, workoutId) {
  if (!validScope(uid, workoutId)) return false;
  return enqueue(uid, workoutId, () => transact("readwrite", store => store.delete(storageKey(uid, workoutId)), () => true, false), false);
}
