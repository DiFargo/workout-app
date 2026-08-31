import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildTrainerActionCenter,
  buildTrainerClientListItems,
  buildTrainerClientSnapshot,
  buildTrainerTaskDraft,
  getTrainerActionItemTargetTab,
  buildTrainerWorkoutReview
} from "../src/utils/trainerActionCenter.js";
import { getTrainerSummaryDateKey } from "../src/utils/trainerSummaryDates.js";

function dateKeyOffset(offsetDays) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return getTrainerSummaryDateKey(date.getTime());
}

test("trainer action center groups today's work, feedback, tasks and ending programs", () => {
  const today = dateKeyOffset(0);
  const clients = [
    {
      id: "today",
      name: "Today Client",
      workoutCalendar: { plannedWorkouts: [{ id: "slot_1", date: today, status: "planned" }] }
    },
    { id: "feedback", name: "Feedback Client" },
    { id: "ending", name: "Ending Client" },
    { id: "tasks", name: "Task Client" }
  ];
  const summaries = {
    today: {
      assignedProgramId: "p1",
      lastWorkoutAt: dateKeyOffset(-1),
      lastNutritionAt: dateKeyOffset(-1),
      lastMeasurementAt: dateKeyOffset(-7)
    },
    feedback: {
      assignedProgramId: "p1",
      lastWorkoutAt: dateKeyOffset(-1),
      lastNutritionAt: dateKeyOffset(-1),
      lastMeasurementAt: dateKeyOffset(-7),
      workoutFeedbackAttention: { id: "comment", reason: "client comment" }
    },
    ending: {
      assignedProgramId: "p1",
      lastWorkoutAt: dateKeyOffset(-1),
      lastNutritionAt: dateKeyOffset(-1),
      lastMeasurementAt: dateKeyOffset(-7),
      programEndingAttention: { id: "endingSoon", reason: "ending soon" }
    },
    tasks: {
      assignedProgramId: "p1",
      lastWorkoutAt: dateKeyOffset(-1),
      lastNutritionAt: dateKeyOffset(-1),
      lastMeasurementAt: dateKeyOffset(-7),
      nutritionDays7: 4,
      activeTrainerTasksCount: 2
    }
  };

  const center = buildTrainerActionCenter(clients, summaries);

  assert.deepEqual(center.todayWorkouts.map((item) => item.client.id), ["today"]);
  assert.deepEqual(center.feedbackItems.map((item) => item.client.id), ["feedback"]);
  assert.deepEqual(center.programEndingItems.map((item) => item.client.id), ["ending"]);
  assert.deepEqual(center.taskItems.map((item) => item.client.id), ["tasks"]);
  assert.deepEqual(center.priorityItems.map((item) => item.client.id), ["feedback", "ending", "today"]);
  assert.ok(center.quickActions.some((item) => item.id === "createTask"));
});

test("trainer action center keeps one priority row per client with several signals", () => {
  const today = dateKeyOffset(0);
  const clients = [{
    id: "multi",
    name: "Multi signal client",
    workoutCalendar: { plannedWorkouts: [{ id: "slot_1", date: today, status: "planned" }] }
  }];
  const summaries = {
    multi: {
      assignedProgramId: "p1",
      lastWorkoutAt: dateKeyOffset(-1),
      lastNutritionAt: dateKeyOffset(-1),
      lastMeasurementAt: dateKeyOffset(-7),
      workoutFeedbackAttention: { id: "comment", reason: "client comment" },
      activeTrainerTasksCount: 1
    }
  };

  const center = buildTrainerActionCenter(clients, summaries);

  assert.equal(center.todayWorkouts.length, 1);
  assert.equal(center.feedbackItems.length, 1);
  assert.equal(center.taskItems.length, 1);
  assert.deepEqual(center.priorityItems.map((item) => item.client.id), ["multi"]);
});

test("trainer action items open the relevant client tab", () => {
  assert.equal(getTrainerActionItemTargetTab({}, "feedbackItems"), "messages");
  assert.equal(getTrainerActionItemTargetTab({}, "taskItems"), "tasks");
  assert.equal(getTrainerActionItemTargetTab({}, "programEndingItems"), "workouts");
  assert.equal(getTrainerActionItemTargetTab({}, "todayWorkouts"), "workouts");
  assert.equal(getTrainerActionItemTargetTab({ attention: { type: "measure" } }), "bodyProgress");
  assert.equal(getTrainerActionItemTargetTab({ attention: { type: "nutrition" } }), "nutrition");
  assert.equal(getTrainerActionItemTargetTab({ attention: { type: "payment" } }), "calendar");
  assert.equal(getTrainerActionItemTargetTab({ attention: { type: "task" } }), "tasks");
  assert.equal(getTrainerActionItemTargetTab({ attention: { type: "activity" } }), "overview");
  assert.equal(getTrainerActionItemTargetTab({
    attention: { type: "workout" },
    summary: { workoutFeedbackAttention: { id: "feedback" }, activeTrainerTasksCount: 1 }
  }), "workouts");
});

test("trainer client list uses every client summary for search, filters and priority", () => {
  const clients = [
    { id: "active", name: "Active", goal: "mass" },
    { id: "lost", name: "Lost", goal: "cut" },
    { id: "noProgram", name: "No Program", email: "plain@example.com" }
  ];
  const summaries = {
    active: {
      assignedProgramId: "p1",
      lastWorkoutAt: dateKeyOffset(-1),
      lastNutritionAt: dateKeyOffset(-1),
      lastMeasurementAt: dateKeyOffset(-7),
      workoutDateKeysCurrentWeek: [dateKeyOffset(-1)],
      nutritionDays7: 5,
      programCompletionPercent: 50
    },
    lost: {
      assignedProgramId: "p2",
      lastWorkoutAt: dateKeyOffset(-15),
      lastNutritionAt: dateKeyOffset(-1),
      lastMeasurementAt: dateKeyOffset(-7)
    }
  };

  const attentionItems = buildTrainerClientListItems(clients, summaries, { filter: "attention" });
  assert.deepEqual(attentionItems.map((item) => item.client.id), ["lost", "noProgram"]);

  const noProgramItems = buildTrainerClientListItems(clients, summaries, { filter: "noProgram" });
  assert.deepEqual(noProgramItems.map((item) => item.client.id), ["noProgram"]);

  const inactiveItems = buildTrainerClientListItems(clients, summaries, { filter: "inactive" });
  assert.deepEqual(inactiveItems.map((item) => item.client.id), ["lost"]);

  const searchItems = buildTrainerClientListItems(clients, summaries, { search: "plain" });
  assert.deepEqual(searchItems.map((item) => item.client.id), ["noProgram"]);

  const allItems = buildTrainerClientListItems(clients, summaries);
  assert.equal(allItems[0].client.id, "lost");
  assert.equal(allItems.at(-1).client.id, "active");
});

test("trainer client snapshot keeps top-card facts compact", () => {
  const snapshot = buildTrainerClientSnapshot(
    { id: "client_1", name: "Ilya", goal: "recomp", workoutsPerWeek: 4 },
    {
      assignedProgramId: "program_1",
      assignedWorkoutCount: 8,
      completedWorkoutCount: 3,
      programCompletionPercent: 38,
      lastWorkoutAt: "2026-06-20T10:00:00.000Z",
      lastNutritionAt: "2026-06-19",
      lastMeasurementAt: "2026-06-18"
    },
    [{ id: "task_1", status: "progress" }, { id: "task_2", status: "completed" }],
    [{ id: "h1", date: "2026-06-20T10:00:00.000Z", clientComment: "Felt good" }]
  );

  assert.equal(snapshot.clientId, "client_1");
  assert.equal(snapshot.currentProgramId, "program_1");
  assert.equal(snapshot.programCompletionPercent, 38);
  assert.equal(snapshot.activeTasksCount, 1);
  assert.equal(snapshot.lastClientComment, "Felt good");
});

test("trainer workout review compares plan and actual workout facts", () => {
  const review = buildTrainerWorkoutReview(
    {
      id: "history_1",
      workoutName: "Upper",
      clientComment: "Shoulder pain after press",
      postWorkoutFeedback: { id: "hard", title: "Hard" },
      exercises: [
        { name: "Bench", sets: [{ reps: 10, enteredWeight: 80 }, { reps: 8, enteredWeight: 80 }] },
        { name: "Row", sets: [{ reps: 12, enteredWeight: 60 }] }
      ]
    },
    {
      id: "workout_1",
      exercises: [
        { name: "Bench", sets: [{}, {}] },
        { name: "Row", sets: [{}] },
        { name: "Curl", sets: [{}] }
      ]
    }
  );

  assert.equal(review.plannedExercisesCount, 3);
  assert.equal(review.completedExercisesCount, 2);
  assert.equal(review.plannedSetsCount, 4);
  assert.equal(review.completedSetsCount, 3);
  assert.deepEqual(review.skippedExercises, ["Curl"]);
  assert.equal(review.volumeKg, 2160);
  assert.equal(review.hasPainComment, true);
  assert.equal(review.needsTrainerReply, true);
});

test("trainer task draft creates actionable task presets", () => {
  assert.deepEqual(buildTrainerTaskDraft("measurements", { dueDate: "2026-06-20" }), {
    title: "\u0421\u0434\u0435\u043b\u0430\u0442\u044c \u0437\u0430\u043c\u0435\u0440\u044b \u0442\u0435\u043b\u0430",
    target: "measurements",
    type: "measurements",
    dueDate: "2026-06-20",
    description: "",
    status: "progress",
    completedAt: ""
  });

  assert.equal(buildTrainerTaskDraft("custom", { title: "Check nutrition diary" }).type, "custom");
});

test("trainer dashboard keeps the focused action flow without generic aggregate stats", async () => {
  const source = await readFile("src/components/trainer/TrainerWorkspace.jsx", "utf8");

  assert.match(source, /<TrainerDailyJournal/);
  assert.match(source, /actionCenter=\{actionCenter\}/);
  assert.doesNotMatch(source, /trainerNextMetrics/);
  assert.doesNotMatch(source, /DashboardMetric/);
});
