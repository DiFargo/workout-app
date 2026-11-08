// Exact-owner maintenance. Dry-run by default; only ordering metadata changes.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { createPersonalHistoryReader, decodeFirestoreFields } from "./inspect-personal-exercise-history.mjs";

const apply = process.argv.slice(2).includes("--apply");
assert.ok(process.argv.slice(2).every(arg => arg === "--apply"));
const email = "mistersasori@gmail.com";
try {
  const reader = await createPersonalHistoryReader();
  const owner = await reader.findOwner(email);
  assert.equal(owner.profile.role, "client");
  const require = createRequire(import.meta.url);
  const cli = resolve(".npm-cache/_npx/7084310e8c2c604f/node_modules/firebase-tools/lib");
  const { Client, getAccessToken } = require(resolve(cli, "apiv2.js"));
  const client = new Client({ urlPrefix: "https://firestore.googleapis.com" });
  const opts = { skipLog: { reqBody: true, resBody: true } };
  const root = `/v1/projects/tren-85720/databases/(default)/documents/users/${encodeURIComponent(owner.uid)}`;
  const response = await client.get(root, { ...opts, queryParams: { "mask.fieldPaths": "workoutCalendar" } });
  const profile = response.body;
  const calendar = decodeFirestoreFields(profile.fields).workoutCalendar;
  const planned = calendar.plannedWorkouts;
  assert.equal(planned.length, 8);
  const documents = await reader.listOwned(owner.uid, "workouts");
  const selected = planned.map(slot => {
    const document = documents.find(doc => doc.name.split("/").at(-1) === slot.workoutId);
    assert.ok(document);
    return { document, workout: decodeFirestoreFields(document.fields) };
  });
  assert.equal(new Set(planned.map(slot => slot.workoutId)).size, 8);
  const ordered = Array.from({ length: 8 }, (_, index) => {
    const matches = selected.filter(item => item.workout.name === `Тренировка ${index + 1}`);
    assert.equal(matches.length, 1);
    return matches[0];
  });
  const orders = ordered.map(item => item.workout.order);
  const alreadyFixed = orders.every((order, index) => order === index + 1);
  assert.ok(alreadyFixed || JSON.stringify(orders) === JSON.stringify([33, 34, 35, 4, 37, 38, 39, 40]));
  assert.ok(ordered.every(item => item.workout.order === item.workout.sortOrder));
  const fields = ["date", "workoutId", "workoutName"];
  const hr = await client.post(`${root}:runQuery`, { structuredQuery: {
    select: { fields: fields.map(fieldPath => ({ fieldPath })) }, from: [{ collectionId: "history" }], limit: 200
  } }, opts);
  const history = hr.body.filter(item => item.document).map(item => item.document);
  const ownIds = new Set(planned.map(slot => slot.workoutId));
  const completed = history.map(doc => decodeFirestoreFields(doc.fields)).filter(item => ownIds.has(item.workoutId))
    .sort((left, right) => String(left.date).localeCompare(String(right.date)));
  assert.equal(completed.length, 5);
  assert.deepEqual(completed.map(item => item.workoutName), [1, 2, 3, 4, 5].map(number => `Тренировка ${number}`));
  const wireSlots = profile.fields.workoutCalendar.mapValue.fields.plannedWorkouts.arrayValue.values;
  const nextWire = ordered.map(({ document }, index) => {
    const id = document.name.split("/").at(-1);
    const slot = wireSlots.find(value => value.mapValue.fields.workoutId.stringValue === id);
    return { mapValue: { fields: { ...slot.mapValue.fields, order: { integerValue: String(index + 1) }, index: { integerValue: String(index) } } } };
  });
  const calendarFixed = JSON.stringify(wireSlots) === JSON.stringify(nextWire);
  const writes = ordered.flatMap(({ document, workout }, index) => workout.order === index + 1 ? [] : [{
    update: { name: document.name, fields: { order: { integerValue: String(index + 1) }, sortOrder: { integerValue: String(index + 1) } } },
    updateMask: { fieldPaths: ["order", "sortOrder"] }, currentDocument: { updateTime: document.updateTime }
  }]);
  if (!calendarFixed) writes.push({
    update: { name: profile.name, fields: { workoutCalendar: { mapValue: { fields: { plannedWorkouts: { arrayValue: { values: nextWire } } } } } } },
    updateMask: { fieldPaths: ["workoutCalendar.plannedWorkouts"] }, currentDocument: { updateTime: profile.updateTime }
  });
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", matched: true, days: 8, completed: 5,
    remaining: 3, plannedWrites: writes.length, historyWrites: 0, dateChanges: 0 }));
  if (apply && writes.length) {
    await mkdir("artifacts/calendar-order-repair", { recursive: true });
    await writeFile("artifacts/calendar-order-repair/before.json", JSON.stringify({
      profile: { name: profile.name, updateTime: profile.updateTime, plannedWorkouts: wireSlots },
      workouts: selected.map(({ document }) => ({ name: document.name, updateTime: document.updateTime,
        order: document.fields.order, sortOrder: document.fields.sortOrder }))
    }, null, 2), { flag: "wx" });
    const token = await getAccessToken();
    const verify = history.map(doc => ({ verify: doc.name, currentDocument: { updateTime: doc.updateTime } }));
    const result = await fetch("https://firestore.googleapis.com/v1/projects/tren-85720/databases/(default)/documents:commit", {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ writes: [...verify, ...writes] }), signal: AbortSignal.timeout(30000)
    });
    assert.ok(result.ok, "Commit rejected; inspect read-only before any retry");
    console.log(JSON.stringify({ applied: writes.length, historyWrites: 0, backupSaved: true }));
  }
} catch {
  console.error("Calendar repair stopped. No automatic retry; reconcile with dry-run.");
  process.exitCode = 1;
}
