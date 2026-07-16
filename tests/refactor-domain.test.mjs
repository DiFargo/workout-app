import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  buildWorkoutFinishSummary,
  formatCompactTimer,
  formatWorkoutElapsedDuration,
  getDefaultWorkoutModePreference,
  getEstimatedWorkoutDuration
} from "../src/domain/workoutPresentation.js";
import {
  getActiveTrainerTasksCount,
  getClientTrainerTaskDestination,
  getClientPlateauInfo,
  getMeasurementWeightValue,
  inferClientTrainerTaskDestination
} from "../src/domain/clientInsights.js";
import { searchLazyNutritionCatalog } from "../src/data/nutrition-catalog/lazyCatalog.js";

test("compact workout timer handles invalid and long values", () => {
  assert.equal(formatCompactTimer(-10), "0:00");
  assert.equal(formatCompactTimer(65), "1:05");
  assert.equal(formatCompactTimer(3605), "60:05");
});

test("workout elapsed duration keeps readable russian labels", () => {
  assert.equal(formatWorkoutElapsedDuration(0, 1000), "—");
  assert.equal(formatWorkoutElapsedDuration(1000, 11_000), "10 сек");
  assert.equal(formatWorkoutElapsedDuration(1000, 126_000), "2 мин 5 сек");
  assert.equal(formatWorkoutElapsedDuration(1000, 3_901_000), "1 ч 5 мин");
});

test("workout finish summary builds stats and progress copy", () => {
  const summary = buildWorkoutFinishSummary({
    workoutDurationText: "42 мин 10 сек",
    completedExercisesCount: 5,
    totalSetsDone: 14,
    totalVolumeDone: 12345.6,
    volumeProgress: 8,
    workoutHistorySyncState: "synced"
  });

  assert.deepEqual(summary.stats.slice(0, 3), [
    { label: "Время", value: "42 мин 10 сек" },
    { label: "Упражнения", value: 5 },
    { label: "Подходы", value: 14 }
  ]);
  assert.equal(summary.stats[3].label, "Объём");
  assert.match(summary.stats[3].value, /12\s346 кг/);
  assert.match(summary.progressText, /объём \+8%/);
  assert.match(summary.adviceText, /Восстановись/);
  assert.equal(summary.syncText, "Синхронизировано");
});

test("workout finish summary handles first saved point", () => {
  const summary = buildWorkoutFinishSummary({
    workoutDurationText: "0 сек",
    totalSetsDone: 0,
    volumeProgress: null,
    isWorkoutSaved: true,
    workoutHistorySyncState: "local"
  });

  assert.deepEqual(summary.stats, [{ label: "Время", value: "меньше минуты" }]);
  assert.equal(summary.progressText, "Первая точка прогресса сохранена.");
  assert.match(summary.adviceText, /заполни вес/);
  assert.equal(summary.syncText, "Сохранено локально · ждёт синхронизации");
});

test("explicit workout duration remains the preferred estimate", () => {
  assert.match(getEstimatedWorkoutDuration({ durationMinutes: 47.6 }), /48/);
});

test("default workout mode preference returns a fresh object", () => {
  const first = getDefaultWorkoutModePreference();
  const second = getDefaultWorkoutModePreference();

  assert.deepEqual(first, { mode: "", remember: false });
  assert.notEqual(first, second);
});

test("measurement weight accepts comma decimals and rejects invalid values", () => {
  assert.equal(getMeasurementWeightValue({ weight: "89,5" }), 89.5);
  assert.equal(getMeasurementWeightValue({ values: { weight: "75.2" } }), 75.2);
  assert.equal(getMeasurementWeightValue({ weight: "0" }), null);
  assert.equal(getMeasurementWeightValue({ weight: "unknown" }), null);
});

test("plateau detection compares measurements at least two weeks apart", () => {
  const plateau = getClientPlateauInfo([
    { weight: "80.2", date: "2026-06-11" },
    { weight: "80.0", date: "2026-05-25" }
  ]);

  assert.equal(plateau.isPlateau, true);
  assert.equal(plateau.days, 17);
  assert.equal(plateau.delta, 0.2);
});

test("active trainer task count ignores completed tasks", () => {
  assert.equal(getActiveTrainerTasksCount([
    { status: "completed" },
    { completedAt: "2026-06-20T12:00:00.000Z" },
    { status: "progress" },
    { title: "Проверить замеры" }
  ]), 2);
  assert.equal(getActiveTrainerTasksCount(null), 0);
});

test("trainer task destination understands russian client tasks", () => {
  assert.equal(inferClientTrainerTaskDestination("Загрузи фото прогресса спереди"), "progressPhotos");
  assert.equal(inferClientTrainerTaskDestination("Сделай замеры талии и веса"), "measurements");
  assert.equal(inferClientTrainerTaskDestination("Заполни дневник питания за сегодня"), "nutrition");
  assert.equal(inferClientTrainerTaskDestination("Напиши заметку по тренировке"), "workouts");
  assert.equal(inferClientTrainerTaskDestination("Обнови параметры профиля"), "profile");
  assert.equal(inferClientTrainerTaskDestination("Посмотри историю прогресса"), "progress");
});

test("trainer task destination prefers explicit saved target", () => {
  assert.equal(getClientTrainerTaskDestination({
    target: "measurements",
    title: "Фото прогресса"
  }), "measurements");
  assert.equal(getClientTrainerTaskDestination({
    type: "custom",
    title: "Нужно записать ужин"
  }), "nutrition");
});

test("lazy nutrition catalog loads once and returns local matches", async () => {
  const originalFetch = globalThis.fetch;
  const files = {
    "/nutrition-catalog/foods.compact.json": "public/nutrition-catalog/foods.compact.json",
    "/nutrition-catalog/alias-prefix-index.json": "public/nutrition-catalog/alias-prefix-index.json",
    "/nutrition-catalog/alias-exact-index.json": "public/nutrition-catalog/alias-exact-index.json"
  };
  let fetchCount = 0;

  globalThis.fetch = async (url) => {
    fetchCount += 1;
    const filePath = files[url];
    assert.ok(filePath, `Unexpected catalog URL: ${url}`);
    const data = JSON.parse(await fs.readFile(filePath, "utf8"));
    return { ok: true, json: async () => data };
  };

  try {
    const first = await searchLazyNutritionCatalog("\u043c\u043e\u043b\u043e\u043a\u043e", 8);
    const second = await searchLazyNutritionCatalog("\u043a\u0435\u0444\u0438\u0440", 8);

    assert.equal(first.length, 8);
    assert.match(first[0].name, /\u041c\u043e\u043b\u043e\u043a\u043e/i);
    assert.ok(second.length > 0);
    assert.equal(fetchCount, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
