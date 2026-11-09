import assert from "node:assert/strict";
import test from "node:test";
import { buildProfileDashboardTasks } from "../src/features/client/profile/profileDashboardTasks.js";

const build = trainerNotifications => buildProfileDashboardTasks({ trainerNotifications });

test("trainer row requires loaded active non-message tasks", () => {
  assert.deepEqual(buildProfileDashboardTasks(), []);
  assert.deepEqual(build(null), []);
  assert.deepEqual(build([]), []);
  assert.deepEqual(build([null, undefined, "invalid", []]), []);
  assert.deepEqual(buildProfileDashboardTasks({ trainerNotifications: [{ id: "todo", title: "Замеры" }], trainerTasksReady: false }), []);
  assert.deepEqual(build([
    { id: "done", title: "Замеры", status: "completed" },
    { id: "done-at", title: "Фото", completedAt: "2026-11-09T12:00:00Z" },
    { id: "message", title: "Сообщение", notificationType: "message", status: "progress" }
  ]), []);
});

test("one trainer task keeps its actual title and description without invented details", () => {
  const [task] = build([{ id: "todo", title: "  Заполнить дневник  ", description: "  Запишите сегодняшний ужин.  " }]);
  assert.deepEqual(task, {
    id: "trainer", kind: "trainer", taskCount: 1, title: "Заполнить дневник",
    note: "Запишите сегодняшний ужин.", actionLabel: "Открыть задание"
  });
  const [untitled] = build([{ id: "todo", title: " " }]);
  assert.equal(untitled.title, "Задание тренера");
  assert.equal(untitled.note, "");
});

test("trainer deadlines remain active in past and future and invalid dates are not fabricated", () => {
  for (const dueDate of ["2020-01-10", "2030-11-14"]) {
    const [task] = build([{ id: "todo", title: "Фото прогресса", dueDate }]);
    assert.equal(task.taskCount, 1);
    assert.match(task.note, /^До /);
    assert.ok(task.note.includes(dueDate.slice(0, 4)));
  }
  for (const dueDate of ["2026-02-31", "invalid", ""]) {
    const [task] = build([{ id: "todo", title: "Фото", dueDate, description: "Описание тренера" }]);
    assert.equal(task.note, "Описание тренера");
  }
});

test("multiple trainer tasks occupy one row with the full Russian task count", () => {
  for (const [count, title] of [[2, "2 задания от тренера"], [5, "5 заданий от тренера"], [11, "11 заданий от тренера"], [21, "21 задание от тренера"]]) {
    const tasks = build(Array.from({ length: count }, (_, index) => ({ id: `todo-${index}`, title: `Задание ${index}` })));
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].taskCount, count);
    assert.equal(tasks[0].title, title);
    assert.equal(tasks[0].actionLabel, "Открыть задания");
  }
});

test("trainer aggregate preserves source data and fits between workout and check-ins", () => {
  const source = Object.freeze([
    Object.freeze({ id: "second", title: "Заполнить дневник", dueDate: "2030-11-14" }),
    Object.freeze({ id: "first", title: "Добавить фото", description: "Спереди и сбоку" })
  ]);
  const before = JSON.stringify(source);
  const args = {
    workoutState: "ready", workoutScheduleStatus: "today", workoutTitle: "Тренировка 1",
    weightCheckIn: { enabled: true, isDue: true },
    measurementsCheckIn: { enabled: true, isDue: true },
    progressPhotoCheckIn: { enabled: true, isDue: true }
  };
  assert.deepEqual(buildProfileDashboardTasks(args).map(task => task.id), ["workout", "weight", "measurements", "photos"]);
  const result = buildProfileDashboardTasks({ ...args, trainerNotifications: source });
  assert.deepEqual(result.map(task => task.id), ["workout", "trainer", "weight", "measurements", "photos"]);
  assert.equal(result[1].taskCount, 2);
  assert.equal(JSON.stringify(source), before);
});

test("trainer row and count update when a task is completed", () => {
  const first = { id: "first", title: "Фото" }, second = { id: "second", title: "Замеры" };
  assert.equal(build([first, second])[0].taskCount, 2);
  assert.equal(build([{ ...first, status: "completed" }, second])[0].title, "Замеры");
  assert.deepEqual(build([{ ...first, status: "completed" }, { ...second, completedAt: "2026-11-09T12:00:00Z" }]), []);
});
