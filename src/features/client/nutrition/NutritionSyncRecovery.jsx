import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Cloud } from "lucide-react";
import { auth } from "../../../firebase.js";
import { captureAuthSession } from "../../../utils/authSession.js";
import { showAppConfirm, showAppError } from "../../../utils/appFeedback.js";
import { isNutritionDayStorageEnabled } from "../../../utils/nutritionDayStorageConfig.js";
import { getFailedNutritionSync } from "../../../utils/offlineSyncStorage.js";
import { getNutritionSaveFeedback, subscribeNutritionSaveFeedback } from "../../../utils/nutritionSyncRevision.js";
import styles from "./NutritionSyncRecovery.module.css";

export default function NutritionSyncRecovery({ onReplay, onRefresh }) {
  const [pendingState, setPending] = useState(null);
  const [busySession, setBusy] = useState(null);
  const [recoveryError, setRecoveryError] = useState(null);
  const inFlight = useRef(null);
  const feedback = useSyncExternalStore(subscribeNutritionSaveFeedback, () => getNutritionSaveFeedback(auth), () => null);
  const uid = auth.currentUser?.uid;
  useEffect(() => {
    if (!uid) return undefined;
    const session = captureAuthSession(auth);
    let active = true;
    const refresh = async () => {
      try {
        const client = isNutritionDayStorageEnabled() ? await import("../../../utils/nutritionDayClient.js") : null;
        if (active && session.isCurrent()) setPending({ session, items: client?.listPendingNutritionDayMutations(uid) || [] });
      } catch { /* A signed-out component has no pending-data surface. */ }
    };
    const handleChange = event => { if (!event.detail?.uid || event.detail.uid === uid) void refresh(); };
    void refresh();
    window.addEventListener("nutrition-storage-pending", handleChange);
    window.addEventListener("storage", handleChange);
    return () => { active = false; window.removeEventListener("nutrition-storage-pending", handleChange); window.removeEventListener("storage", handleChange); };
  }, [uid]);
  if (!uid) return null;
  const pending = pendingState?.session.isCurrent() ? pendingState.items : [];
  const legacyPending = !feedback && Boolean(getFailedNutritionSync(uid)?.nutrition);
  const busy = busySession?.isCurrent() === true;
  const error = recoveryError?.session.isCurrent() ? recoveryError.message : "";
  const requiresConfirmation = feedback?.requiresConfirmation || pending.some(item => item.status === "rebase-required");
  const hasPending = pending.length > 0 || legacyPending || (feedback && feedback.state !== "cloud");
  if (!hasPending && !feedback && !busy && !error) return null;
  const state = busy || feedback?.sending ? "saving"
    : error || feedback?.state === "error" ? "error" : hasPending ? "local" : "cloud";
  const localMissing = feedback?.localSaved === false;
  const localConfirmed = feedback?.localSaved === true || pending.length > 0 || legacyPending;
  const title = state === "saving" ? "Сохраняем в облако…"
    : state === "cloud" ? "Сохранено в облаке"
      : state === "error" ? localMissing ? "Не удалось сохранить на устройстве" : "Не удалось сохранить в облаке"
        : "Сохранено только на устройстве";
  const description = error || (requiresConfirmation
    ? "Версия дневника изменилась. Проверьте сохранённые записи перед переносом."
    : localMissing ? "Не закрывайте приложение. Освободите место на устройстве и повторите сохранение."
      : state === "error" ? localConfirmed ? "Локальная копия сохранена. Проверьте интернет и повторите отправку."
        : "Не закрывайте приложение. Проверьте интернет и повторите сохранение."
        : state === "local" ? "Записи ещё не отправлены. Синхронизируйте их при подключении к интернету."
          : state === "saving" ? "Дождитесь подтверждения. Дневник можно продолжать заполнять." : "");
  const recover = async () => {
    if (inFlight.current?.isCurrent() || feedback?.sending) return;
    const session = captureAuthSession(auth);
    inFlight.current = session;
    setBusy(session);
    setRecoveryError(null);
    try {
      const client = isNutritionDayStorageEnabled() ? await import("../../../utils/nutritionDayClient.js") : null;
      if (!session.isCurrent()) return;
      if (requiresConfirmation && client) {
        const confirmed = await showAppConfirm({ title: "Перенести сохранённые записи?",
          text: "Дневник был обновлён или очищен. Перенос может вернуть ранее удалённые записи. Исходная локальная копия сохранится; без подтверждения ничего не переносится.",
          confirmText: "Перенести записи", cancelText: "Пока не переносить" });
        if (!confirmed || !session.isCurrent()) return;
        await client.rebasePendingNutritionDayMutations(uid, { confirmed: true });
      }
      if (!session.isCurrent()) return;
      window.dispatchEvent(new CustomEvent("nutrition-save-retry", { detail: { uid } }));
      await onReplay?.();
      if (!session.isCurrent()) return;
      setPending({ session, items: client?.listPendingNutritionDayMutations(uid) || [] });
      await onRefresh?.();
    } catch (error) {
      if (session.isCurrent()) {
        const message = error.code === "nutrition/upgrade-required"
          ? "Обновите приложение. Неотправленные записи сохранены на устройстве."
          : "Не удалось синхронизировать записи. Проверьте интернет и повторите отправку.";
        setRecoveryError({ session, message });
        showAppError("savedLocal", message);
      }
    } finally {
      if (inFlight.current === session) inFlight.current = null;
      if (session.isCurrent()) setBusy(null);
    }
  };
  return <section className={`${styles.notice} ${state === "cloud" ? styles.compact : ""}`} role="status" aria-live="polite" aria-atomic="true"
    title={state === "cloud" ? title : undefined}
    data-testid={hasPending || busy || error ? "nutrition-sync-recovery" : "nutrition-save-status"} data-save-state={state}>
    {state === "cloud" ? <Cloud className={styles.cloudIcon} aria-hidden="true" /> : null}
    <p className={styles.title}>{title}</p>
    {description ? <p className={styles.description}>{description}</p> : null}
    {state !== "cloud" ? <button type="button" disabled={state === "saving" || !onReplay} onClick={recover}>
      {state === "saving" ? "Синхронизируем…" : requiresConfirmation ? "Проверить и перенести" : state === "error" ? "Повторить сохранение" : "Синхронизировать"}
    </button> : null}
  </section>;
}
