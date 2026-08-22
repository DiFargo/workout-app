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
import {
  findLazyNutritionCatalogByBarcode,
  searchLazyNutritionCatalog
} from "../src/data/nutrition-catalog/lazyCatalog.js";

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

  assert.deepEqual(first, { mode: "individual", remember: false });
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

test("lazy nutrition catalog keeps the first search lightweight and returns local matches", async () => {
  const originalFetch = globalThis.fetch;
  const catalogFiles = [
    "foods.compact.json",
    "alias-prefix-index.json",
    "alias-exact-index.json",
    "search-token-index.json",
    "barcode-index.json"
  ];
  const files = Object.fromEntries(
    ["reference", "sku"].flatMap((layer) => catalogFiles.map((filename) => [
      `/nutrition-catalog/${layer}/${filename}`,
      `public/nutrition-catalog/${layer}/${filename}`
    ]))
  );
  let fetchCount = 0;

  globalThis.fetch = async (url) => {
    fetchCount += 1;
    const filePath = files[url];
    if (!filePath) return { ok: false, status: 404 };
    const data = JSON.parse(await fs.readFile(filePath, "utf8"));
    return { ok: true, json: async () => data };
  };

  try {
    const first = await searchLazyNutritionCatalog("\u0431\u0430\u043d\u0430\u043d", 8);
    const second = await searchLazyNutritionCatalog("\u044f\u0431\u043b\u043e\u043a\u043e", 8);
    const third = await searchLazyNutritionCatalog("\u043c\u043e\u043b\u043e\u043a\u043e", 8);
    const fourth = await searchLazyNutritionCatalog("\u0433\u043e\u0432\u044f\u0434\u0438\u043d\u0430", 8);
    const skuFoods = JSON.parse(await fs.readFile("public/nutrition-catalog/sku/foods.compact.json", "utf8"));
    const barcodeSku = skuFoods.find((food) => food.bc);
    const scanned = await findLazyNutritionCatalogByBarcode(barcodeSku.bc);

    assert.ok(first.some((food) => /Bananas, raw/i.test(food.name)));
    assert.ok(second.length > 0);
    assert.ok(third.some((food) => /^Milk, whole/i.test(food.name)));
    assert.ok(fourth.some((food) => /^Beef,/i.test(food.name)));
    assert.equal(scanned?.id, barcodeSku.id);
    assert.equal(scanned?.barcode, barcodeSku.bc);
    // Initial search needs only compact foods and the token index for each
    // layer; the SKU barcode index is fetched separately on demand.
    assert.equal(fetchCount, 5);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
