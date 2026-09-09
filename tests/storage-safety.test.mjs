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

test("quota failure never silently truncates a pending array", () => {
  globalThis.localStorage = createQuotaStorage({ maxValueLength: 160, failFirstWrite: true });
  const backups = Array.from({ length: 20 }, (_, index) => ({
    id: `backup-${index}`,
    payload: "x".repeat(20)
  }));

  localStorage.seed("workout_nutrition_backup_v1:user", [{ id: "previous" }]);
  assert.equal(safeWriteJsonStorage("workout_nutrition_backup_v1:user", backups), false);

  const stored = JSON.parse(globalThis.localStorage.getItem("workout_nutrition_backup_v1:user"));
  assert.deepEqual(stored, [{ id: "previous" }]);
});

test("quota retry evicts only reproducible search caches, preserving pending backups", () => {
  globalThis.localStorage = createQuotaStorage({ failFirstWrite: true });
  globalThis.localStorage.seed("workout_nutrition_backup_v1:user", [{ payload: "old backup" }]);
  globalThis.localStorage.seed("workout_history_pending_backup_v1:user", [{ payload: "old sync" }]);
  globalThis.localStorage.seed("workout_food_search_cache_v1:user", { results: [] });

  assert.equal(safeWriteJsonStorage("workout_nutrition_v1:user", { diary: { today: [] } }), true);

  assert.notEqual(globalThis.localStorage.getItem("workout_nutrition_backup_v1:user"), null);
  assert.notEqual(globalThis.localStorage.getItem("workout_history_pending_backup_v1:user"), null);
  assert.equal(globalThis.localStorage.getItem("workout_food_search_cache_v1:user"), null);
  assert.deepEqual(JSON.parse(globalThis.localStorage.getItem("workout_nutrition_v1:user")), {
    diary: { today: [] }
  });
});
