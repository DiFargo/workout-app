import test from "node:test";
import assert from "node:assert/strict";
import { advanceAuthSession } from "../src/utils/authSession.js";
import {
  beginNutritionSaveFeedback, finishNutritionSaveFeedback, getNutritionSaveFeedback,
  rememberNutritionLocalSave, subscribeNutritionSaveFeedback, hasConfirmedNutritionCloudState,
  isNutritionStateDirty, rememberNutritionCloudState
} from "../src/utils/nutritionSyncRevision.js";

const nutrition = water => ({ __uid: "client", updatedAt: String(water), days: { today: { water } } });
const createAuth = () => ({ currentUser: { uid: "client" } });
const local = (auth, value, options = {}) => rememberNutritionLocalSave(auth, value, { localSaved: true, ...options });

test("питание: локальная копия и начало отправки не считаются подтверждением облака", () => {
  const auth = createAuth();
  assert.equal(getNutritionSaveFeedback(auth), null);
  local(auth, nutrition(100));
  assert.equal(getNutritionSaveFeedback(auth).state, "local");
  const ticket = beginNutritionSaveFeedback(auth, "client", nutrition(100));
  assert.equal(getNutritionSaveFeedback(auth).state, "saving");
  finishNutritionSaveFeedback(auth, ticket);
  assert.equal(getNutritionSaveFeedback(auth).state, "cloud");
});

test("питание: старый ack после нового локального ввода оставляет новый ввод локальным", () => {
  const auth = createAuth();
  const first = nutrition(100), latest = nutrition(200);
  local(auth, first);
  const ticket = beginNutritionSaveFeedback(auth, "client", first);
  local(auth, latest);
  finishNutritionSaveFeedback(auth, ticket);
  assert.equal(getNutritionSaveFeedback(auth).state, "local");
  assert.deepEqual(latest, nutrition(200), "feedback не изменяет введённые данные");
  const retry = beginNutritionSaveFeedback(auth, "client", latest);
  finishNutritionSaveFeedback(auth, retry);
  assert.equal(getNutritionSaveFeedback(auth).state, "cloud");
});

test("питание: поздняя ошибка старой отправки не отменяет подтверждение нового ввода", () => {
  const auth = createAuth();
  local(auth, nutrition(100));
  const old = beginNutritionSaveFeedback(auth, "client", nutrition(100));
  local(auth, nutrition(200));
  const current = beginNutritionSaveFeedback(auth, "client", nutrition(200));
  finishNutritionSaveFeedback(auth, current);
  finishNutritionSaveFeedback(auth, old, new Error("old network failure"));
  assert.equal(getNutritionSaveFeedback(auth).state, "cloud");
});

test("питание: отказ облака сохраняет честный статус локальной копии и допускает повтор", () => {
  const auth = createAuth();
  local(auth, nutrition(100));
  const ticket = beginNutritionSaveFeedback(auth, "client", nutrition(100));
  finishNutritionSaveFeedback(auth, ticket, Object.assign(new Error("conflict"), { code: "nutrition/rebase-required" }));
  assert.equal(getNutritionSaveFeedback(auth).state, "error");
  assert.equal(getNutritionSaveFeedback(auth).localSaved, true);
  assert.equal(getNutritionSaveFeedback(auth).requiresConfirmation, true);
  const retry = beginNutritionSaveFeedback(auth, "client", nutrition(100));
  assert.equal(getNutritionSaveFeedback(auth).state, "saving");
  finishNutritionSaveFeedback(auth, retry);
  assert.equal(getNutritionSaveFeedback(auth).state, "cloud");
});

test("питание: ошибка локального хранилища не обещает локальную копию", () => {
  const auth = createAuth();
  local(auth, nutrition(100), { localSaved: false });
  assert.equal(getNutritionSaveFeedback(auth).state, "error");
  assert.equal(getNutritionSaveFeedback(auth).localSaved, false);
  local(auth, nutrition(100), { localSaved: false, queued: true });
  assert.equal(getNutritionSaveFeedback(auth).state, "local", "durable очередь тоже сохраняет полную копию");
});

test("питание: подтверждённая загрузка отличается от непроверенной локальной копии", () => {
  const auth = createAuth();
  local(auth, nutrition(100));
  assert.equal(getNutritionSaveFeedback(auth).state, "local");
  local(auth, nutrition(100), { cloudConfirmed: true });
  assert.equal(getNutritionSaveFeedback(auth).state, "cloud");
});

test("питание: пустой/legacy snapshot без updatedAt не доказывает cloud baseline даже при dirty=false", () => {
  const auth = createAuth();
  for (const value of [{ __uid: "client", days: {} }, { __uid: "client", days: { today: { water: 100 } } }]) {
    assert.equal(isNutritionStateDirty(auth, value), false, "предикат очереди остаётся прежним");
    assert.equal(hasConfirmedNutritionCloudState(auth), false);
    local(auth, value, { cloudConfirmed: hasConfirmedNutritionCloudState(auth) && !isNutritionStateDirty(auth, value) });
    assert.equal(getNutritionSaveFeedback(auth).state, "local");
  }
  rememberNutritionCloudState(auth, { days: {} });
  assert.equal(hasConfirmedNutritionCloudState(auth), true);
  advanceAuthSession(auth);
  assert.equal(hasConfirmedNutritionCloudState(auth), false, "baseline не переживает same-UID relogin");
});

test("питание: UID и auth-сессия изолируют статусы, старые ответы не публикуют события", () => {
  const auth = createAuth();
  let updates = 0;
  const unsubscribe = subscribeNutritionSaveFeedback(() => { updates++; });
  local(auth, nutrition(100));
  const old = beginNutritionSaveFeedback(auth, "client", nutrition(100));
  auth.currentUser = { uid: "other" };
  advanceAuthSession(auth);
  assert.equal(getNutritionSaveFeedback(auth), null);
  const before = updates;
  finishNutritionSaveFeedback(auth, old);
  assert.equal(updates, before);
  assert.equal(beginNutritionSaveFeedback(auth, "client", nutrition(100)), null);
  rememberNutritionLocalSave(auth, nutrition(100), { localSaved: true });
  assert.equal(getNutritionSaveFeedback(auth), null, "чужой owner не создаёт статус текущего аккаунта");
  local(auth, { ...nutrition(200), __uid: "other" });
  const sameUidOld = beginNutritionSaveFeedback(auth, "other", { ...nutrition(200), __uid: "other" });
  advanceAuthSession(auth);
  finishNutritionSaveFeedback(auth, sameUidOld);
  assert.equal(getNutritionSaveFeedback(auth), null);
  unsubscribe();
  const after = updates;
  local(auth, { ...nutrition(200), __uid: "other" });
  assert.equal(updates, after, "отписка удаляет listener");
});
