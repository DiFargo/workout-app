import { useEffect } from "react";
import { captureAuthSession } from "../../../utils/authSession.js";
import { mergeNutritionStates } from "../../../utils/nutritionStateMerge.js";
import { isNutritionDayStorageEnabled, withNutritionPendingScope } from "../../../utils/nutritionDayStorageConfig.js";

import { saveNutritionStateWithMerge } from "../../../utils/nutritionStateStorage";
import { setFailedNutritionSync, acknowledgeNutritionSync, getFailedNutritionSync } from "../../../utils/offlineSyncStorage";
import {
  acknowledgeNutritionCloudState, beginNutritionSave, isNutritionStateDirty,
  backupNutritionLocalSnapshot, persistNutritionLocalSnapshot, sameNutritionState, rememberNutritionLocalSave,
  hasConfirmedNutritionCloudState
} from "../../../utils/nutritionSyncRevision.js";

export function useNutritionRuntimeEffects({
  auth,
  barcodeScannerOpen,
  barcodeSearchEnabled,
  barcodeVideoRef,
  nutrition,
  nutritionCloudReady,
  nutritionDateKey,
  nutritionStorageKey,
  nutritionBackupStorageKey,
  nutritionUndoTimerRef,
  page = "nutrition",
  user,
  addNutritionFoodFromPicker,
  findFoodByBarcode,
  loadNutritionFromFirebase,
  setNutrition,
  showAppError,
  setBarcodeScannerError,
  setBarcodeScannerOpen,
  setNutritionBarcode
}) {
  useEffect(() => () => {
    if (nutritionUndoTimerRef.current) {
      window.clearTimeout(nutritionUndoTimerRef.current);
    }
  }, [nutritionUndoTimerRef]);

  useEffect(() => {
    const session = captureAuthSession(auth);
    if (!session.isCurrent() || session.uid !== user?.uid) return;
    if (!user?.uid || (nutrition.__uid && nutrition.__uid !== user.uid)) return;
    if (!nutrition.__uid && !nutrition.updatedAt) return;

    const localNutrition = {
      ...nutrition,
      __uid: user.uid,
      updatedAt: nutrition.updatedAt || ""
    };
    const persistLocal = () => {
      if (!session.isCurrent()) return;
      const localSaved = persistNutritionLocalSnapshot(nutritionStorageKey, user.uid, localNutrition);
      if (!localSaved) {
        showAppError("storage", "Не удалось сохранить питание на устройстве. Освободите место и повторите сохранение.");
      }
      if (!backupNutritionLocalSnapshot(nutritionBackupStorageKey, user.uid, localNutrition)) {
        showAppError("storage", "Не удалось сохранить резервную копию питания на устройстве.");
      }
      // Queue real local changes immediately; the 650 ms timer only delays I/O.
      // A cloud hydration is not itself a local mutation.
      const dirty = isNutritionStateDirty(auth, localNutrition);
      const cloudConfirmed = nutritionCloudReady && hasConfirmedNutritionCloudState(auth) && !dirty;
      let queued = false;
      if (nutritionCloudReady && dirty) {
        const pending = getFailedNutritionSync(user.uid)?.nutrition;
        const pendingForUser = pending && (!pending.__uid || pending.__uid === user.uid) ? pending : {};
        const queuedNutrition = withNutritionPendingScope({ ...mergeNutritionStates(localNutrition, pendingForUser), __uid: user.uid },
          pending && (!pending.__uid || pending.__uid === user.uid) ? pending : null);
        queued = sameNutritionState(pending, queuedNutrition) || setFailedNutritionSync(user.uid, queuedNutrition);
        if (!queued) showAppError("storage", "Локальная копия изменений питания не сохранена.");
      }
      rememberNutritionLocalSave(auth, localNutrition, { localSaved, queued, cloudConfirmed });
    };
    persistLocal();
    const retryLocal = event => { if (event.detail?.uid === session.uid) persistLocal(); };
    window.addEventListener("nutrition-save-retry", retryLocal);
    return () => window.removeEventListener("nutrition-save-retry", retryLocal);
  }, [auth, nutrition, nutritionCloudReady, nutritionBackupStorageKey, nutritionStorageKey, showAppError, user?.uid]);

  useEffect(() => {
    if (!barcodeScannerOpen || !barcodeSearchEnabled) return undefined;

    let stream;
    let stopped = false;
    let frameId;

    async function startScanner() {
      try {
        setBarcodeScannerError("");

        if (!("BarcodeDetector" in window)) {
          setBarcodeScannerError("Сканер штрихкодов не поддерживается этим браузером. Введи код вручную.");
          return;
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false
        });

        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          stream = undefined;
          return;
        }

        if (barcodeVideoRef.current) {
          barcodeVideoRef.current.srcObject = stream;
          await barcodeVideoRef.current.play();
        }
        if (stopped) return;

        const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });

        const scan = async () => {
          if (stopped || !barcodeVideoRef.current) return;

          try {
            const codes = await detector.detect(barcodeVideoRef.current);
            if (stopped) return;
            if (codes.length > 0) {
              const value = codes[0].rawValue || "";
              const food = await findFoodByBarcode(value);
              if (stopped) return;
              setNutritionBarcode("");
              setBarcodeScannerOpen(false);
              if (food) addNutritionFoodFromPicker(food);
              else setBarcodeScannerError("Штрихкод пока не найден. Проверь цифры или найди продукт по названию.");
              return;
            }
          } catch (error) {
            console.error(error);
          }

          if (!stopped) frameId = requestAnimationFrame(scan);
        };

        scan();
      } catch (error) {
        if (stopped) return;
        console.error(error);
        setBarcodeScannerError("Не удалось открыть камеру. Проверь разрешение камеры или введи штрихкод вручную.");
      }
    }

    startScanner();

    return () => {
      stopped = true;
      if (frameId) cancelAnimationFrame(frameId);
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
    // Scanner callbacks are event handlers supplied by the current nutrition route.
    // Restarting the camera whenever their identity changes would interrupt scanning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barcodeScannerOpen, barcodeSearchEnabled, user?.uid]);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser || !nutritionCloudReady || (nutrition.__uid && nutrition.__uid !== currentUser.uid)) return undefined;
    const queuedSnapshot = getFailedNutritionSync(currentUser.uid)?.nutrition;
    if (!queuedSnapshot && (!nutrition.updatedAt || !isNutritionStateDirty(auth, nutrition))) return undefined;

    const session = captureAuthSession(auth);
    const timer = setTimeout(() => {
      if (!session.isCurrent()) return;
      const pending = getFailedNutritionSync(currentUser.uid)?.nutrition;
      const pendingForUser = pending && (!pending.__uid || pending.__uid === currentUser.uid) ? pending : {};
      const userNutritionState = mergeNutritionStates(nutrition, pendingForUser);
      const nutritionPayload = withNutritionPendingScope({
        ...userNutritionState,
        __uid: currentUser.uid,
        updatedAt: userNutritionState.updatedAt || ""
      }, pending && (!pending.__uid || pending.__uid === currentUser.uid) ? pending : null);
      const queued = JSON.stringify(pending) === JSON.stringify(nutritionPayload)
        || setFailedNutritionSync(currentUser.uid, nutritionPayload);
      if (!queued) showAppError("storage", "Локальная копия не сохранена: недостаточно места. Отправляю данные в облако.");
      const saveTicket = beginNutritionSave(auth);
      saveNutritionStateWithMerge(currentUser.uid, nutritionPayload)
        .then((mergedNutrition) => {
          if (!session.isCurrent() || !setNutrition || !mergedNutrition) return;
          acknowledgeNutritionCloudState(auth, saveTicket, mergedNutrition);
          acknowledgeNutritionSync(currentUser.uid, nutritionPayload);
          setNutrition((current) => {
            if (!session.isCurrent() || (current?.__uid && current.__uid !== session.uid)) return current;
            const next = { ...mergeNutritionStates(current, mergedNutrition), __uid: session.uid };
            return sameNutritionState(current, next) ? current : next;
          });
        })
        .catch((error) => {
          console.error("Nutrition save error", error);
          if (session.isCurrent()) showAppError(error.code === "nutrition/rebase-required" ? "savedLocal"
            : typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "firebase",
          error.code === "nutrition/rebase-required" ? "Версия дневника изменилась. Локальные изменения сохранены; для их переноса требуется подтверждение."
            : error.code === "nutrition/archive-required" ? error.message : undefined);
          // The immediate full backup and pending queue already hold this edit.
          // Never duplicate it or replace a newer edit after a failed request.
        });
    }, 650);

    return () => clearTimeout(timer);
  }, [auth, auth.currentUser, nutrition, nutritionBackupStorageKey, nutritionCloudReady, setNutrition, showAppError]);

  // Bounded freshness: refresh on returning to the app and at most once per
  // minute while visible. Existing loader merges concurrent local edits and
  // guards the authentication generation, including same-account re-login.
  useEffect(() => {
    const session = captureAuthSession(auth);
    if (!session.isCurrent() || !nutritionCloudReady || !loadNutritionFromFirebase || page !== "nutrition") return undefined;
    let active = true;
    let pending = false;
    let lastRefresh = 0;
    const refresh = async () => {
      if (!active || pending || !session.isCurrent() || document.visibilityState === "hidden"
        || navigator.onLine === false || Date.now() - lastRefresh < 60000) return;
      pending = true;
      lastRefresh = Date.now();
      try { await loadNutritionFromFirebase(session.uid, isNutritionDayStorageEnabled() && nutritionDateKey
        ? { mode: "days", dayKeys: [nutritionDateKey] } : {}); }
      finally { pending = false; }
    };
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
    // Loader identity changes with coordinator renders; it does not need to
    // restart the bounded freshness clock on every local diary edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, user?.uid, nutritionCloudReady, page, nutritionDateKey]);
}
