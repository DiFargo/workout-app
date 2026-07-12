import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getTrainerActionErrorCode,
  getTrainerActionErrorStatus
} from "../src/utils/trainerActionStatus.js";

test("trainer action status maps Firebase error codes to actionable text", () => {
  assert.match(
    getTrainerActionErrorStatus({ code: "permission-denied" }, "fallback"),
    /Недостаточно прав/
  );
  assert.match(
    getTrainerActionErrorStatus({ code: "firestore/unauthenticated" }, "fallback"),
    /Сессия истекла/
  );
  assert.match(
    getTrainerActionErrorStatus({ code: "unavailable" }, "fallback"),
    /Firebase временно недоступен/
  );
});

test("trainer action status can infer common backend messages", () => {
  assert.equal(getTrainerActionErrorCode({ message: "PERMISSION_DENIED" }), "permission-denied");
  assert.equal(getTrainerActionErrorCode({ message: "Network request failed" }), "unavailable");
  assert.equal(getTrainerActionErrorCode({ message: "Deadline exceeded" }), "deadline-exceeded");
});

test("trainer action status preserves fallback for unknown errors", () => {
  assert.equal(getTrainerActionErrorStatus({ code: "unknown" }, "fallback"), "fallback");
  assert.equal(getTrainerActionErrorStatus(null, "fallback"), "fallback");
});

test("trainer handlers use shared error statuses and pending messages", () => {
  const calendarSource = readFileSync("src/features/trainer/trainerClientCalendarHandlers.js", "utf8");
  const messagingSource = readFileSync("src/features/trainer/trainerMessagingHandlers.js", "utf8");
  const taskSource = readFileSync("src/features/trainer/clientTrainerTaskHandlers.js", "utf8");
  const programSource = readFileSync("src/features/trainer/trainerProgramTemplateHandlers.js", "utf8");

  assert.match(calendarSource, /getTrainerActionErrorStatus/);
  assert.match(calendarSource, /STATUS_SCHEDULE_SAVING/);
  assert.match(messagingSource, /STATUS_TELEGRAM_SENDING/);
  assert.match(taskSource, /STATUS_TASK_CREATING/);
  assert.match(taskSource, /getTrainerActionErrorStatus/);
  assert.match(programSource, /getTrainerActionErrorStatus/);
});
