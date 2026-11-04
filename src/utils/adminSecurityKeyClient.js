import { captureAuthSession } from "./authSession.js";

export function securityKeyErrorMessage(error) {
  if (["NotAllowedError", "AbortError"].includes(error?.name) || error?.code === "ERROR_CEREMONY_ABORTED") {
    return "Подтверждение отменено. Подключите ключ и попробуйте ещё раз.";
  }
  if (error?.name === "InvalidStateError") return "Этот ключ уже добавлен. Используйте другой ключ для резервного входа.";
  if (error?.name === "SecurityError") return "Откройте Zmena в обычном браузере по адресу tren-85720.web.app и повторите.";
  return error?.userMessage || "Не удалось подтвердить ключ. Проверьте подключение и повторите попытку.";
}

export function createAdminSecurityKeyClient({ auth, request, startRegistration, startAuthentication, exchangeToken }) {
  function session() {
    const guard = captureAuthSession(auth);
    if (!guard.isCurrent()) throw new Error("Authentication required");
    return guard;
  }
  function assertCurrent(guard) {
    if (!guard.isCurrent()) throw Object.assign(new Error("Session changed"), { userMessage: "Аккаунт изменился. Откройте настройки заново." });
  }
  async function post(body, guard) {
    assertCurrent(guard);
    const response = await request("/api/admin/security-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    assertCurrent(guard);
    const data = await response.json();
    assertCurrent(guard);
    if (!response.ok) throw Object.assign(new Error(data.error || "Key request failed"), { code: data.error, userMessage: data.message });
    return data;
  }
  return {
    async status() {
      const data = await post({ action: "status" }, session());
      if (typeof data?.required !== "boolean" || !Array.isArray(data.keys) || data.keys.length > 5 ||
          (data.verifiedUntil !== null && !Number.isSafeInteger(data.verifiedUntil))) {
        throw Object.assign(new Error("Invalid key status"), { userMessage: "Не удалось проверить защиту входа. Повторите проверку." });
      }
      return data;
    },
    async confirm({ register = false, label = "" } = {}) {
      const guard = session();
      const purpose = register ? "registration" : "authentication";
      const options = await post({ action: `${purpose}-options` }, guard);
      const response = await (register ? startRegistration : startAuthentication)({ optionsJSON: options.options });
      assertCurrent(guard);
      const verified = await post({ action: `${purpose}-verify`, challengeId: options.challengeId, response,
        ...(register && label.trim() ? { label: label.trim().slice(0, 80) } : {}) }, guard);
      assertCurrent(guard);
      if (typeof verified.customToken !== "string" || !verified.customToken) throw new Error("Missing proof token");
      // Firebase owns token persistence. Never store credentials or proof in app storage.
      await exchangeToken(auth, verified.customToken);
      if (auth.currentUser?.uid !== guard.uid) throw new Error("Account changed");
      return verified;
    }
  };
}
