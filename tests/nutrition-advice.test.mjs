import test from "node:test";
import assert from "node:assert/strict";
import { buildNutritionAdvice, buildNutritionDayFeedback, buildNutritionSummaryCollapsedText } from "../src/utils/nutritionAdvice.js";
import { buildAiNutritionDayModel } from "../src/utils/aiNutritionAnalysis.js";

const goals = { calories: 2500, protein: 199, fat: 69, carbs: 300 };
const context = { goals, todayKey: "2026-09-19", dateKey: "2026-09-19" };
const feedback = (totals, extra = {}) => buildNutritionDayFeedback({ ...context, totals, ...extra });

test("empty diary has no nutritional verdict, including past and future dates", () => {
  for (const dateKey of ["2026-09-18", "2026-09-19", "2026-09-20"]) {
    const result = feedback({}, { dateKey });
    assert.equal(result.state, "empty");
    assert.equal(result.hasEnoughDataForScore, false);
    assert.doesNotMatch(result.summary + result.adaptiveAdvice, /белка мало|хороший дефицит|отличный день/i);
    assert.equal(result.badges.length, 1);
  }
});

test("missing calorie target asks for a target instead of claiming excess", () => {
  assert.equal(feedback({ calories: 200 }, { goals: {} }).state, "no-target");
});

test("nonfinite and negative values never leak into copy", () => {
  const result = feedback({ calories: Infinity, protein: NaN, fat: -3 });
  assert.equal(result.state, "empty");
  assert.doesNotMatch(JSON.stringify(result), /Infinity|NaN/);
});

test("screenshot case prioritizes calorie excess and never suggests eating more", () => {
  const result = feedback({ calories: 2829, protein: 200.9, fat: 95.8, carbs: 277.8 });
  assert.equal(result.state, "over-target");
  assert.match(result.summary, /329 ккал выше цели/);
  assert.match(result.summary, /27 г/);
  assert.match(result.adaptiveAdvice, /Не нужно есть дополнительно/);
  assert.doesNotMatch(result.adaptiveAdvice, /на остаток дня|добавь|добери|лучше белок/i);
});

test("low protein does not override calories already consumed", () => {
  const result = feedback({ calories: 2700, protein: 60, fat: 100, carbs: 380 });
  assert.equal(result.state, "over-target");
  assert.match(result.adaptiveAdvice, /В следующие дни/);
  assert.doesNotMatch(result.adaptiveAdvice, /добери|добавь|если планируешь ещё/i);
});

test("reached calorie target does not recommend extra carbs or protein", () => {
  const result = feedback({ calories: 2500, protein: 90, fat: 100, carbs: 210 });
  assert.equal(result.state, "at-target");
  assert.match(result.summary, /Цель по калориям достигнута/);
  assert.doesNotMatch(result.adaptiveAdvice, /добери|добавь/i);
});

test("near-target states explain tolerance rather than push exact matching", () => {
  for (const calories of [2375, 2400, 2499]) {
    const result = feedback({ calories, protein: 120 });
    assert.equal(result.state, "near-target");
    assert.match(result.adaptiveAdvice, /Не нужно стремиться к точному совпадению/);
  }
});

test("partial diary is described as partial and next meal advice is conditional", () => {
  const result = feedback({ calories: 800, protein: 40, fat: 30, carbs: 90 });
  assert.equal(result.state, "in-progress");
  assert.equal(result.hasEnoughDataForScore, false);
  assert.match(result.summary, /В дневнике 800 из 2500 ккал/);
  assert.match(result.adaptiveAdvice, /^Если планируешь ещё приём пищи/);
});

test("high fat with calories remaining gives conditional practical advice", () => {
  const result = feedback({ calories: 1800, protein: 100, fat: 100, carbs: 130 });
  assert.match(result.adaptiveAdvice, /без дополнительных жирных соусов/);
  assert.doesNotMatch(result.adaptiveAdvice, /перед тренировкой|вечером|остаток дня/i);
});

test("carb advice does not invent an upcoming workout", () => {
  const result = feedback({ calories: 1600, protein: 199, fat: 60, carbs: 60 });
  assert.match(result.adaptiveAdvice, /источником углеводов/);
  assert.doesNotMatch(result.adaptiveAdvice, /перед тренировкой/);
});

test("past day advice checks diary completeness, never asks to eat for the past", () => {
  const result = feedback({ calories: 1000, protein: 90 }, { dateKey: "2026-09-18" });
  assert.equal(result.state, "past-below-target");
  assert.match(result.adaptiveAdvice, /внесены ли все приёмы/);
  assert.match(result.adaptiveAdvice, /Не нужно доедать за прошлый день/);
  assert.doesNotMatch(result.adaptiveAdvice, /если ещё будешь есть|на остаток дня/i);
});

test("future entries are plans, not food assumed eaten", () => {
  const result = feedback({ calories: 2800, protein: 200 }, { dateKey: "2026-09-20" });
  assert.equal(result.state, "future");
  assert.equal(result.hasEnoughDataForScore, false);
  assert.match(result.adaptiveAdvice, /предварительные записи/);
});

test("collapsed text, detailed model and legacy advice share the same decision", () => {
  const totals = { calories: 2829, protein: 200.9, fat: 95.8, carbs: 277.8 };
  const options = { ...context, totals };
  const result = buildNutritionDayFeedback(options);
  const model = buildAiNutritionDayModel({ goals, days: {} }, { foods: [totals] }, context);
  assert.equal(buildNutritionSummaryCollapsedText(options), result.collapsedText);
  assert.equal(buildNutritionAdvice(options), result.summary + " " + result.adaptiveAdvice);
  assert.equal(model.summary, result.summary);
  assert.equal(model.adaptiveAdvice, result.adaptiveAdvice);
});

test("day model keeps historical context without time-based diet assumptions", () => {
  const model = buildAiNutritionDayModel({ goals, days: {} }, { foods: [{ calories: 600, protein: 20 }] }, { dateKey: "2026-09-18", todayKey: "2026-09-19" });
  assert.equal(model.period, "past");
  assert.doesNotMatch(model.summary + model.adaptiveAdvice + model.weeklyText, /на остаток дня|Сегодня|добавь 100/i);
});

test("history average is informational, not a trigger for a new calorie prescription", () => {
  const model = buildAiNutritionDayModel({ goals, days: { "2026-09-18": { foods: [{ calories: 3000 }] } } }, { foods: [{ calories: 200 }] });
  assert.match(model.weeklyText, /Неполные записи влияют/);
  assert.doesNotMatch(model.weeklyText, /добавь|меньше|остаток дня/);
});

test("legacy array context remains compatible for trainer analytics", () => {
  const model = buildAiNutritionDayModel({ goals, days: {} }, { foods: [{ calories: 2500, protein: 199, fat: 69, carbs: 300 }] }, []);
  assert.ok(Number.isFinite(model.score));
  assert.equal(model.state, "at-target");
});
