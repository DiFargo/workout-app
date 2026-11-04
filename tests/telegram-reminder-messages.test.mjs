import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTelegramAppMessage,
  buildProgressReminderMessage,
  buildTelegramAppKeyboard,
  buildTelegramHelpMessage,
  buildTelegramLinkConfirmationMessage,
  buildTelegramLinkErrorMessage,
  buildTelegramInviteAcceptanceMessage,
  buildTelegramInviteErrorMessage,
  buildTelegramSettingsMessage,
  buildTelegramWelcomeMessage,
  buildWorkoutReminderMessage,
  getTelegramQuickAction
} from "../functions/telegramReminderMessages.js";

test("workout reminder is concise, formatted and escapes trainer-provided text", () => {
  const message = buildWorkoutReminderMessage({
    workout: { name: "Ноги <A&B>", exercises: [{}, {}, {}] },
    workoutTime: "18:30",
    eventText: "среда, 14 октября",
    offsetHours: 24
  });

  assert.match(message, /<b>Скоро тренировка<\/b>/);
  assert.match(message, /Завтра, среда, 14 октября, в 18:30\./);
  assert.match(message, /<b>Ноги &lt;A&amp;B&gt;<\/b>/);
  assert.match(message, /В плане 3 упражнения\./);
  assert.match(message, /упражнения, подходы и видео/);
});

test("workout reminder supports short offsets and singular exercise count", () => {
  const message = buildWorkoutReminderMessage({
    workout: { name: "Тренировка", exercises: [{}] },
    workoutTime: "09:15",
    offsetHours: 1
  });

  assert.match(message, /Начало через час — в 09:15\./);
  assert.match(message, /В плане 1 упражнение\./);
});

test("progress reminders are distinct and describe the configured cadence", () => {
  assert.match(buildProgressReminderMessage({ type: "photo", intervalDays: 14 }), /Фото прогресса/i);
  assert.match(buildProgressReminderMessage({ type: "weight", intervalDays: 7 }), /взвеситься/i);
  assert.match(buildProgressReminderMessage({ type: "measurements", intervalDays: 30 }), /Замеры тела/i);
  for (const interval of [7, 14, 30]) {
    assert.match(buildProgressReminderMessage({ type: "photo", intervalDays: interval }), new RegExp(`${interval} дней`));
  }
});

test("welcome and Telegram linking messages explain the next step", () => {
  const welcome = buildTelegramWelcomeMessage("Илья <3");
  assert.match(welcome, /Привет, Илья &lt;3!/);
  assert.match(welcome, /помощник по тренировкам и прогрессу/);
  assert.match(welcome, /напиши «настройки»/i);
  assert.match(buildTelegramLinkConfirmationMessage(), /Telegram подключён/);
  assert.match(buildTelegramLinkConfirmationMessage(), /Профиль → Уведомления/);
  assert.match(buildTelegramLinkErrorMessage(), /создай новую/i);
});

test("Telegram invite replies make the next action clear and escape usernames", () => {
  assert.match(buildTelegramInviteAcceptanceMessage("Илья"), /Привет, Илья!/);
  const mismatch = buildTelegramInviteErrorMessage("telegram-invite-username-mismatch", "<other_user>");
  assert.match(mismatch, /&lt;other_user&gt;/);
  assert.match(mismatch, /нужного Telegram-аккаунта/);
});

test("help, settings and app responses are compact and discoverable in Russian", () => {
  assert.match(buildTelegramHelpMessage(), /Как начать/);
  assert.match(buildTelegramHelpMessage(), /Профиль → Уведомления/);
  assert.match(buildTelegramSettingsMessage(), /интервалы и время/);
  assert.match(buildTelegramAppMessage(), /открыть свой план и настройки/);
  assert.equal(getTelegramQuickAction("/help@zmena_teleg_bot"), "help");
  assert.equal(getTelegramQuickAction("/notifications"), "settings");
  assert.equal(getTelegramQuickAction("Настройки уведомлений"), "settings");
  assert.equal(getTelegramQuickAction("Открыть приложение"), "app");
  assert.equal(getTelegramQuickAction("обычное сообщение тренеру"), "");
  assert.equal(getTelegramQuickAction("/unknown"), "");
});

test("app button opens only a valid HTTPS Mini App URL", () => {
  assert.deepEqual(buildTelegramAppKeyboard("https://tren-85720.web.app/"), {
    inline_keyboard: [[{
      text: "Открыть приложение",
      web_app: { url: "https://tren-85720.web.app/" }
    }]]
  });
  assert.equal(buildTelegramAppKeyboard("javascript:alert(1)"), null);
});
