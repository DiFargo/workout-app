import assert from "node:assert/strict";
import test from "node:test";

import { safeWriteJsonStorage } from "../src/utils/storageSafety.js";

function createQuotaStorage({ maxValueLength = Infinity, failFirstWrite = false } = {}) {
  const store = new Map();
  let writes = 0;

  return {
    get length() {
      return store.size;
    },
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    key(index) {
      return [...store.keys()][index] || null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      writes += 1;
      if ((failFirstWrite && writes === 1) || String(value).length > maxValueLength) {
        const error = new Error("quota exceeded");
        error.name = "QuotaExceededError";
        error.code = 22;
        throw error;
      }
      store.set(key, String(value));
    },
    seed(key, value) {
      store.set(key, JSON.stringify(value));
    }
  };
}

test("safeWriteJsonStorage compacts backup arrays when localStorage quota is full", () => {
  globalThis.localStorage = createQuotaStorage({ maxValueLength: 160, failFirstWrite: true });
  const backups = Array.from({ length: 20 }, (_, index) => ({
    id: `backup-${index}`,
    payload: "x".repeat(20)
  }));

  assert.equal(safeWriteJsonStorage("workout_nutrition_backup_v1:user", backups), true);

  const stored = JSON.parse(globalThis.localStorage.getItem("workout_nutrition_backup_v1:user"));
  assert.ok(stored.length < backups.length);
  assert.equal(stored[0].id, "backup-0");
});

test("safeWriteJsonStorage drops disposable backups before retrying primary data", () => {
  globalThis.localStorage = createQuotaStorage({ failFirstWrite: true });
  globalThis.localStorage.seed("workout_nutrition_backup_v1:user", [{ payload: "old backup" }]);
  globalThis.localStorage.seed("workout_history_pending_backup_v1:user", [{ payload: "old sync" }]);

  assert.equal(safeWriteJsonStorage("workout_nutrition_v1:user", { diary: { today: [] } }), true);

  assert.equal(globalThis.localStorage.getItem("workout_nutrition_backup_v1:user"), null);
  assert.equal(globalThis.localStorage.getItem("workout_history_pending_backup_v1:user"), null);
  assert.deepEqual(JSON.parse(globalThis.localStorage.getItem("workout_nutrition_v1:user")), {
    diary: { today: [] }
  });
});
