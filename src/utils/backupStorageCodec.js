// Lossless structural sharing for large, repetitive secondary backups only.
// Primary plans, active drafts and pending sync queues keep their existing format.
const FORMAT = "ownset-backup-shared-v1";
export function isCompressibleBackupKey(key) {
  return /^workout_(?:nutrition|plan|global_my_foods)_backup_v1:[^:]+$/.test(String(key));
}

export function encodeBackupJson(raw) {
  if (raw.length < 65536) return raw;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.format === FORMAT) return raw;
    const pool = [], interned = new Map();
    let visits = 0;
    const encode = (value, depth = 0) => {
      if (++visits > 300000 || depth > 80) throw new Error("backup-codec-limit");
      if (value === null || typeof value !== "object") return value;
      const node = Array.isArray(value)
        ? ["a", value.map(item => encode(item, depth + 1))]
        : ["o", Object.entries(value).map(([key, item]) => [key, encode(item, depth + 1)])];
      const signature = JSON.stringify(node);
      let id = interned.get(signature);
      if (id === undefined) { id = pool.length; pool.push(node); interned.set(signature, id); }
      return { r: id };
    };
    const root = encode(parsed);
    const encoded = JSON.stringify({ format: FORMAT, root, pool });
    return encoded.length < raw.length * .85 ? encoded : raw;
  } catch { return raw; }
}

export function decodeBackupJson(value) {
  if (value?.format !== FORMAT) return value;
  if (!Array.isArray(value.pool) || value.pool.length > 300000) throw new Error("invalid-backup-pool");
  let visits = 0;
  const decode = (entry, limit = value.pool.length, depth = 0) => {
    if (++visits > 300000 || depth > 80) throw new Error("backup-decode-limit");
    if (entry === null || typeof entry !== "object") return entry;
    const id = entry.r;
    if (!Number.isInteger(id) || id < 0 || id >= limit) throw new Error("invalid-backup-reference");
    const node = value.pool[id];
    if (!Array.isArray(node) || !Array.isArray(node[1])) throw new Error("invalid-backup-node");
    // Rebuild each occurrence independently: callers must not share mutable data.
    if (node[0] === "a") return node[1].map(item => decode(item, id, depth + 1));
    if (node[0] !== "o") throw new Error("invalid-backup-type");
    return Object.fromEntries(node[1].map(pair => {
      if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== "string") throw new Error("invalid-backup-pair");
      return [pair[0], decode(pair[1], id, depth + 1)];
    }));
  };
  return decode(value.root);
}

export function compactExistingBackupStorage(storage, uid) {
  let saved = 0;
  if (typeof uid !== "string" || !uid || uid.includes(":")) return saved;
  try {
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(key => isCompressibleBackupKey(key) && key.endsWith(`:${uid}`));
    for (const key of keys) {
      try {
        const raw = storage.getItem(key);
        if (!raw) continue;
        const encoded = encodeBackupJson(raw);
        if (encoded.length < raw.length) {
          // Validate a complete round trip before replacing the original atomically.
          if (JSON.stringify(decodeBackupJson(JSON.parse(encoded))) !== raw) continue;
          storage.setItem(key, encoded);
          saved += raw.length - encoded.length;
        }
      } catch { /* Failed replacement leaves the old snapshot untouched. */ }
    }
  } catch { /* A denied browser store is not an empty store. */ }
  return saved;
}
