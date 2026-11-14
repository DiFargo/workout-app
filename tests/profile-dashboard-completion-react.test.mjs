import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { rolldown } from "rolldown";

const bundle = await rolldown({
  input: fileURLToPath(new URL("../src/features/client/profile/ProfileSummaryDashboard.jsx", import.meta.url)),
  platform: "node",
  transform: { jsx: { runtime: "automatic" } },
  external: ["react", "react/jsx-runtime", "lucide-react"],
  plugins: [{ name: "test-css-boundary", load: id => id.endsWith(".css")
    ? { code: "export default new Proxy({}, { get: (_, key) => key });", moduleType: "js" } : null }]
});
const generated = await bundle.generate({ format: "cjs", exports: "named" });
await bundle.close();
const module = { exports: {} };
new Function("require", "module", "exports", generated.output[0].code)(createRequire(import.meta.url), module, module.exports);
const Dashboard = module.exports.default;
const render = (props = {}) => renderToStaticMarkup(React.createElement(Dashboard, {
  workoutState: "ready", workoutScheduleStatus: "upcoming", workoutTitle: "Тренировка 7",
  workoutDate: "18 ноября", workoutCompletedToday: true, ...props
}));

test("после сохранённой сегодня тренировки карточка хвалит и сохраняет переход к следующей", () => {
  const html = render();
  assert.match(html, /Отличная работа!/);
  assert.match(html, /Ты потренировался сегодня/);
  assert.match(html, /Тренировка за сегодня сохранена/);
  assert.match(html, /data-testid="profile-summary-upcoming-workout"/);
  assert.match(html, /Следующая тренировка · 18 ноября/);
  assert.doesNotMatch(html, /Отдых — тоже часть плана|Нет актуальных задач/);
  // The copy credits participation, not a full prescription or a strength record.
  assert.doesNotMatch(html, /Все подходы выполнены|рекорд/);
});

test("похвала не вытесняет незавершённую тренировку и реальные задачи", () => {
  for (const props of [
    { workoutState: "draft" },
    { workoutScheduleStatus: "today" },
    { weightCheckIn: { enabled: true, isDue: true, isFirst: true } },
    { trainerNotifications: [{ id: "task", title: "Заполните дневник", notificationType: "task" }] }
  ]) {
    const html = render(props);
    assert.match(html, /Что важно сегодня\?/);
    assert.doesNotMatch(html, /Отличная работа!|Тренировка за сегодня сохранена/);
    assert.match(html, /data-task-id=/);
  }
});

test("отдых, неизвестные данные и незавершённая загрузка не получают ложную похвалу", () => {
  assert.match(render({ workoutCompletedToday: false }), /Отдых — тоже часть плана/);
  for (const props of [
    { workoutCompletedToday: false },
    { workoutLoadState: "loading" },
    { dataLoadState: { tasks: { status: "loading", hasValue: false } } }
  ]) assert.doesNotMatch(render(props), /Отличная работа!|Тренировка за сегодня сохранена/);
  assert.match(render({ workoutState: "complete" }), /Отличная работа!/);
});
