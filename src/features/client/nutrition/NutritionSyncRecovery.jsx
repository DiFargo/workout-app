import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Check, Cloud, CloudAlert, CloudOff, CloudUpload } from "lucide-react";
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
  const [openSession, setOpenSession] = useState(null);
  const inFlight = useRef(null);
  const statusRef = useRef(null);
  const indicatorRef = useRef(null);
  const detailsId = useId();
  const feedback = useSyncExternalStore(subscribeNutritionSaveFeedback, () => getNutritionSaveFeedback(auth), () => null);
  const uid = auth.currentUser?.uid;
  const expanded = openSession?.isCurrent() === true;
  useEffect(() => {
    if (!expanded) return undefined;
    const closeOutside = event => {
      if (!statusRef.current?.contains(event.target)) setOpenSession(null);
    };
    const closeOnEscape = event => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpenSession(null);
      indicatorRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [expanded]);
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
  const state = busy || feedback?.sending ? "saving"
    : error || feedback?.state === "error" ? "error" : hasPending ? "local" : feedback?.state === "cloud" ? "cloud" : "unknown";
  const localMissing = feedback?.localSaved === false;
  const localConfirmed = feedback?.localSaved === true || pending.length > 0 || legacyPending;
  const title = state === "saving" ? "Сохраняем в облако…"
    : state === "cloud" ? "Сохранено в облаке"
      : state === "error" ? localMissing ? "Не удалось сохранить на устройстве" : "Не удалось сохранить в облаке"
        : state === "local" ? "Сохранено только на устройстве" : "Сохранение пока не подтверждено";
  const description = error || (requiresConfirmation
    ? "Версия дневника изменилась. Проверьте сохранённые записи перед переносом."
    : localMissing ? "Не закрывайте приложение. Освободите место на устройстве и повторите сохранение."
      : state === "error" ? localConfirmed ? "Локальная копия сохранена. Проверьте интернет и повторите отправку."
        : "Не закрывайте приложение. Проверьте интернет и повторите сохранение."
        : state === "local" ? "Записи ещё не отправлены. Синхронизируйте их при подключении к интернету."
          : state === "saving" ? "Дождитесь подтверждения. Дневник можно продолжать заполнять."
            : state === "cloud" ? "Последние изменения дневника подтверждены сервером."
              : "Пока нет подтверждения от сервера. Это не означает, что записи потеряны.");
  const StatusIcon = state === "cloud" ? Cloud : state === "saving" ? CloudUpload
    : state === "error" ? CloudAlert : state === "local" ? CloudOff : Cloud;
  const stateClass = { cloud: styles.stateCloud, saving: styles.stateSaving, local: styles.stateLocal,
    error: styles.stateError, unknown: styles.stateUnknown }[state];
  const recover = async () => {
    if (inFlight.current?.isCurrent() || feedback?.sending) return;
    const session = captureAuthSession(auth);
    if (session.uid !== uid || !session.isCurrent()) return;
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
  return <>
    <section ref={statusRef} className={`${styles.status} ${stateClass}`} title={title}
      data-testid={hasPending || busy || error ? "nutrition-sync-recovery" : "nutrition-save-status"} data-save-state={state}>
      <button ref={indicatorRef} type="button" className={styles.indicator} data-testid="nutrition-save-indicator"
        aria-label={title} aria-expanded={expanded} aria-controls={expanded ? detailsId : undefined}
        onClick={() => setOpenSession(expanded ? null : captureAuthSession(auth))}>
        <StatusIcon aria-hidden="true" />
        {state === "cloud" ? <Check className={styles.checkMark} aria-hidden="true" /> : null}
      </button>
      <span className={styles.announcement} role="status" aria-live="polite" aria-atomic="true">Статус дневника: {title}</span>
      {expanded ? <div id={detailsId} className={styles.details} role="region" aria-labelledby={`${detailsId}-title`} data-testid="nutrition-save-details">
        <p id={`${detailsId}-title`} className={styles.title}>{title}</p>
        <p className={styles.description}>{description}</p>
        {state !== "cloud" && state !== "unknown" ? <button type="button" className={styles.retry} disabled={state === "saving" || !onReplay} onClick={recover}>
          {state === "saving" ? "Синхронизируем…" : requiresConfirmation ? "Проверить и перенести" : state === "error" ? "Повторить сохранение" : "Синхронизировать"}
        </button> : null}
      </div> : null}
    </section>
    {localMissing && state !== "cloud" ? <p className={styles.critical} role="alert">Не удалось сохранить на устройстве. Не закрывайте приложение до подтверждения сохранения.</p> : null}
  </>;
}
