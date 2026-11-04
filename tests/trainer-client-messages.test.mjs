import assert from "node:assert/strict";
import test from "node:test";
import { POST_WORKOUT_FEEDBACK_OPTIONS } from "../src/domain/workoutPresentation.js";
import { getWorkoutNoteItems } from "../src/utils/trainerClientMessages.js";

test("системный advice и выбранная оценка не создают сообщение клиента даже для старой истории", () => {
  const history = POST_WORKOUT_FEEDBACK_OPTIONS.map((feedback, index) => ({
    id: `old-${index}`, workoutId: "day-1", workout: "Тренировка 1", date: "2026-10-30T10:00:00Z",
    clientComment: "", exercises: [], postWorkoutFeedback: { ...feedback }
  }));
  const before = structuredClone(history);
  assert.deepEqual(getWorkoutNoteItems(history), []);
  assert.deepEqual(history, before, "оценка и advice остаются в исходной истории, миграции нет");
});

test("явный комментарий и заметка упражнения сохраняют прежние ID, контекст ответа и текст", () => {
  const feedback = POST_WORKOUT_FEEDBACK_OPTIONS.find(option => option.id === "normal");
  const entry = Object.freeze({
    id: "history-42", clientSaveId: "save-42", workoutId: "day-4", workoutName: "Тренировка 4",
    finishedAt: "2026-10-30T10:00:00Z", clientComment: "  Последний подход дался тяжело.  ",
    postWorkoutFeedback: Object.freeze({ ...feedback }),
    exercises: Object.freeze([Object.freeze({ id: "bench", name: "Жим", clientNote: "  Дискомфорт в плече.  " })])
  });
  assert.deepEqual(getWorkoutNoteItems([entry]), [{
    id: "history-42-comment", title: "Тренировка 4", source: "Комментарий", text: "Последний подход дался тяжело.",
    date: entry.finishedAt, workoutId: "day-4", workoutName: "Тренировка 4", historyId: "history-42", sourceCommentId: "history-42-comment"
  }, {
    id: "history-42-exercise-bench", title: "Жим", source: "Упражнение", text: "Дискомфорт в плече.",
    date: entry.finishedAt, workoutId: "day-4", workoutName: "Тренировка 4", historyId: "history-42",
    exerciseId: "bench", exerciseName: "Жим", sourceCommentId: "history-42-exercise-bench"
  }]);
});

test("совпавший с советом явный текст клиента не удаляется по эвристике", () => {
  for (const feedback of POST_WORKOUT_FEEDBACK_OPTIONS) {
    const notes = getWorkoutNoteItems([{ id: "explicit", clientComment: feedback.advice, postWorkoutFeedback: feedback }]);
    assert.equal(notes.length, 1);
    assert.equal(notes[0].id, "explicit-comment");
    assert.equal(notes[0].text, feedback.advice);
  }
});

test("личная заметка basic и один только readiness не становятся сообщениями тренеру", () => {
  assert.deepEqual(getWorkoutNoteItems([{ personalNote: "Личная заметка", clientComment: "  ",
    readiness: { id: "good", title: "Нормально" }, exercises: [{ clientNote: " " }] }]), []);
  assert.deepEqual(getWorkoutNoteItems(null), []);
});

test("порядок новых комментариев и legacy fallback ID сохраняются без мутации истории", () => {
  const history = [{ clientSaveId: "local-save", date: "2026-10-29T10:00:00Z", clientComment: "Старый комментарий" },
    { id: "recent", finishedAt: "2026-10-30T10:00:00Z", exercises: [{ name: "Тяга", clientNote: "Новая заметка" }] }];
  const before = structuredClone(history);
  const notes = getWorkoutNoteItems(history);
  assert.deepEqual(notes.map(note => note.sourceCommentId), ["recent-exercise-0", "local-save-comment"]);
  assert.deepEqual(history, before);
});
