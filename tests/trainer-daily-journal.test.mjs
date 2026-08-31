import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  buildTrainerDailyJournal,
  buildTrainerImmediateActions,
  filterTrainerDailyJournalItems
} from "../src/utils/trainerDailyJournal.js";

const now = new Date("2026-08-17T18:00:00.000Z").getTime();

test("standing program decisions are separated from the daily journal", () => {
  const actionCenter = {
    items: [{
      clientId: "ilya",
      client: { id: "ilya", name: "Ilya" },
      clientName: "Ilya",
      summary: {
        assignedProgramId: "program_1",
        recentEvents: [{
          id: "workout_1",
          type: "workout",
          title: "Тренировка 2",
          date: "2026-08-17T09:30:00.000Z"
        }]
      },
      lastActivityTimestamp: now - 1000
    }, {
      clientId: "pet",
      client: { id: "pet", name: "Pet" },
      clientName: "Pet",
      summary: { assignedProgramId: "", recentEvents: [] },
      status: { id: "noProgram" },
      lastActivityTimestamp: 0
    }],
    priorityItems: [{
      clientId: "pet",
      client: { id: "pet", name: "Pet" },
      clientName: "Pet",
      summary: { assignedProgramId: "", recentEvents: [] },
      status: { id: "noProgram" },
      lastActivityTimestamp: 0
    }],
    taskItems: []
  };
  const journal = buildTrainerDailyJournal(actionCenter, now);
  const immediateActions = buildTrainerImmediateActions(actionCenter);

  assert.equal(journal.attentionCount, 0);
  assert.equal(journal.items.length, 1);
  assert.equal(journal.items[0].title, "Завершена тренировка «Тренировка 2»");
  assert.equal(immediateActions.length, 1);
  assert.equal(immediateActions[0].title, "Нужно настроить клиента");
  assert.equal(immediateActions[0].actionLabel, "Настроить");
  assert.equal(immediateActions[0].target, "workouts");
});

test("daily journal ignores factual events from earlier days", () => {
  const journal = buildTrainerDailyJournal({
    items: [{
      clientId: "ilya",
      client: { id: "ilya", name: "Ilya" },
      summary: {
        assignedProgramId: "program_1",
        recentEvents: [{ id: "old", type: "workout", title: "Старая", date: "2026-08-16T09:30:00.000Z" }]
      }
    }],
    priorityItems: [],
    taskItems: [],
    todayWorkouts: []
  }, now);

  assert.deepEqual(journal.items, []);
});

test("daily journal is ordered from the start of the day to the latest event", () => {
  const now = new Date("2026-08-17T14:00:00").getTime();
  const journal = buildTrainerDailyJournal({
    items: [{
      clientId: "client-1",
      client: { id: "client-1", name: "Илья" },
      summary: {
        recentEvents: [
          { id: "late", type: "nutrition", date: "2026-08-17T12:00:00" },
          { id: "early", type: "workout", date: "2026-08-17T08:00:00" }
        ]
      }
    }]
  }, now);

  assert.deepEqual(journal.items.map((item) => item.icon), ["workout", "nutrition"]);
});

test("daily journal filters sort entries by their action state", () => {
  const items = [
    { id: "recorded-workout", icon: "workout", requiresAction: false },
    { id: "recorded-nutrition", icon: "nutrition", requiresAction: false },
    { id: "action-open", icon: "task", requiresAction: true },
    { id: "action-reviewed", icon: "program", requiresAction: true }
  ];
  const reviewedIds = new Set(["action-reviewed"]);

  assert.equal(filterTrainerDailyJournalItems(items, "action", reviewedIds).length, 1);
  assert.equal(filterTrainerDailyJournalItems(items, "reviewed", reviewedIds).length, 1);
  assert.equal(filterTrainerDailyJournalItems(items, "recorded", reviewedIds).length, 2);
  assert.equal(filterTrainerDailyJournalItems(items, "all", reviewedIds).length, 4);
});

test("immediate action cards open from the entire card and support keyboard activation", async () => {
  const source = await readFile("src/components/trainer/TrainerDailyJournal.jsx", "utf8");

  assert.match(source, /className=\{styles\.immediateActionCard\}/);
  assert.match(source, /role="button"/);
  assert.match(source, /tabIndex=\{0\}/);
  assert.match(source, /onClick=\{\(\) => openImmediateAction\(action\)\}/);
  assert.match(source, /event\.key !== "Enter" && event\.key !== " "/);
});

test("journal entries remain clickable after an action was reviewed", async () => {
  const source = await readFile("src/components/trainer/TrainerDailyJournal.jsx", "utf8");

  assert.match(source, /function openTimelineEvent\(event\)/);
  assert.match(source, /event\.requiresAction && !reviewedIds\.has\(event\.id\)/);
  assert.match(source, /className=\{`\$\{styles\.dailyJournalEvent\} \$\{styles\.dailyJournalEventClickable\}/);
  assert.match(source, /onClick=\{\(\) => openTimelineEvent\(event\)\}/);
  assert.match(source, /dailyJournalReviewed/);
});
