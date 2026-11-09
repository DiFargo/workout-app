import { fetchAuthorizedWithTimeout } from "./apiClient.js";
import { captureAuthSession } from "./authSession.js";

const failure = (code, message) => Object.assign(new Error(message), { code, basicWorkoutAccessMessage: message });
const uncertain = () => failure("basic-access-unconfirmed", "Не удалось подтвердить изменение доступа. Обновите карточку клиента перед повторной попыткой.");
function abortable(promise, signal) {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(promise).then(value => { signal.removeEventListener("abort", abort); resolve(value); }, error => { signal.removeEventListener("abort", abort); reject(error); });
  });
}

// Privileged admission must not enter Firestore SDK's indefinite offline write
// queue. REST uses the same Firebase Rules/key proof and an atomic precondition.
export async function updateAdminBasicWorkoutAccess({ auth, db, clientId, allowed,
  request = fetchAuthorizedWithTimeout, timeoutMs = 16000, readbackTimeoutMs = 8000 }) {
  const session = captureAuthSession(auth), project = db?.app?.options?.projectId;
  if (!session.isCurrent()) throw failure("basic-access-session-changed", "Сеанс изменился. Войдите в аккаунт администратора снова.");
  if (!/^[a-z][a-z0-9-]{3,62}$/.test(project || "") || !/^[A-Za-z0-9_-]{1,128}$/.test(clientId || "") || typeof allowed !== "boolean")
    throw failure("basic-access-invalid-target", "Не удалось определить профиль клиента.");
  const endpoint = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/users/${encodeURIComponent(clientId)}`;
  const assertSession = () => { if (!session.isCurrent()) throw failure("basic-access-session-changed", "Сеанс изменился. Войдите в аккаунт администратора снова."); };
  const readUrl = `${endpoint}?mask.fieldPaths=role&mask.fieldPaths=basicWorkoutAccess&mask.fieldPaths=updatedAt`;
  const bounded = async (operation, duration) => {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(new DOMException("Timeout", "AbortError")), duration);
    const sessionCheck = setInterval(() => {
      if (!session.isCurrent()) controller.abort(failure("basic-access-session-changed", "Сеанс изменился. Войдите в аккаунт администратора снова."));
    }, 100);
    try { return await abortable(operation(controller.signal), controller.signal); }
    finally { clearTimeout(timer); clearInterval(sessionCheck); }
  };
  const send = async (url, options, signal) => {
    assertSession();
    const response = await abortable(request(url, { ...options, signal }, timeoutMs), signal);
    assertSession();
    if (!response.ok) {
      await abortable(response.body?.cancel(), signal);
      if (response.status === 403 || response.status === 401) throw failure("basic-access-permission-denied", "Доступ не изменён. Повторно подтвердите вход администратора ключом безопасности.");
      if ([409, 412].includes(response.status)) throw failure("basic-access-conflict", "Карточка клиента изменилась. Обновите её и повторите действие.");
      if (response.status === 404) throw failure("basic-access-client-missing", "Профиль клиента больше не найден. Обновите список клиентов.");
      throw failure("basic-access-service-unavailable", "Сервис доступа временно недоступен. Повторите попытку.");
    }
    const text = await abortable(response.text(), signal); assertSession();
    if (text.length > 65536) throw uncertain();
    try { return JSON.parse(text); } catch { throw uncertain(); }
  };
  const patch = { basicWorkoutAccess: allowed, updatedAt: new Date().toISOString() };
  const matches = document => document?.fields?.basicWorkoutAccess?.booleanValue === allowed && document?.fields?.updatedAt?.stringValue === patch.updatedAt;
  let writeAttempted = false;
  try {
    await bounded(async signal => {
      const before = await send(readUrl, {}, signal);
      if (before.fields?.role?.stringValue !== "client" || typeof before.updateTime !== "string") throw failure("basic-access-invalid-target", "Доступ можно менять только у действующего профиля клиента.");
      assertSession();
      const url = `${endpoint}?updateMask.fieldPaths=basicWorkoutAccess&updateMask.fieldPaths=updatedAt&currentDocument.updateTime=${encodeURIComponent(before.updateTime)}&mask.fieldPaths=basicWorkoutAccess&mask.fieldPaths=updatedAt`;
      writeAttempted = true;
      const saved = await send(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields: {
        basicWorkoutAccess: { booleanValue: allowed }, updatedAt: { stringValue: patch.updatedAt }
      } }) }, signal);
      if (!matches(saved)) throw uncertain();
    }, timeoutMs);
  } catch (error) {
    assertSession();
    // A lost PATCH response is ambiguous. Only a separate server read bearing
    // this exact operation timestamp can acknowledge success, never local cache.
    if (writeAttempted && !["basic-access-permission-denied", "basic-access-conflict", "basic-access-client-missing", "basic-access-invalid-target"].includes(error.code)) {
      try { const current = await bounded(signal => send(readUrl, {}, signal), readbackTimeoutMs); if (matches(current)) return patch; }
      catch { assertSession(); }
      throw uncertain();
    }
    if (error.basicWorkoutAccessMessage) throw error;
    throw failure("basic-access-unavailable", "Не удалось связаться с сервером. Доступ не изменён. Проверьте соединение и повторите попытку.");
  }
  assertSession();
  return patch;
}
