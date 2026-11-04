import { doc, getDoc } from "firebase/firestore";
import { captureAuthSession } from "../../../utils/authSession.js";
import { runSessionResource } from "../../../utils/sessionResource.js";
import { getFailedNutritionSync, setFailedNutritionSync } from "../../../utils/offlineSyncStorage.js";
import { isNutritionDayStorageEnabled, withNutritionPendingScope } from "../../../utils/nutritionDayStorageConfig.js";
import { rememberNutritionCloudState, persistNutritionLocalSnapshot, sameNutritionState } from "../../../utils/nutritionSyncRevision.js";

import { mergeNutritionStates } from "../../../utils/nutritionStateMerge";
import { getPersonalMyFoodsDocRef } from "../../../utils/personalMyFoodsStorage";
import {
  safeReadUserJsonStorage
} from "../../../utils/userScopedStorage";

const NUTRITION_LOAD_LABEL = "Firebase \u00b7 nutrition load";
const ERROR_LOAD_NUTRITION = "\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043f\u0438\u0442\u0430\u043d\u0438\u0435 \u0438\u0437 Firebase. \u041f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u044e \u043b\u043e\u043a\u0430\u043b\u044c\u043d\u044b\u0435 \u0434\u0430\u043d\u043d\u044b\u0435.";

export function createNutritionCloudLoader({
  auth,
  captureSession = () => captureAuthSession(auth),
  db,
  NUTRITION_STORAGE_KEY,
  startPerformanceCheck,
  endPerformanceCheck,
  showAppError,
  setNutrition,
  setNutritionCloudReady,
  onNutritionCoverageChange
}) {
  async function loadNutritionFromFirebase(uid, options = {}) {
    const session = captureSession();
    if (session.uid !== uid || !session.isCurrent()) return;
    const resourceKey = isNutritionDayStorageEnabled()
      ? `nutrition:${uid}:${options.mode || "full"}:${[...(options.dayKeys || [])].sort().join(",")}` : `nutrition:${uid}`;
    const request = runSessionResource(auth, resourceKey, async ({ isCurrent }) => {
    const requested = { uid, mode: options.mode || "full", requestedDayKeys: options.dayKeys || [] };
    if (session.isCurrent() && isCurrent()) onNutritionCoverageChange?.({ ...requested, loading: true, complete: false, error: null });
    startPerformanceCheck(NUTRITION_LOAD_LABEL, { userId: String(uid || "").slice(0, 6) });
    const initialLocal = safeReadUserJsonStorage(NUTRITION_STORAGE_KEY, uid, {});

    try {
      const dayClient = isNutritionDayStorageEnabled() ? await import("../../../utils/nutritionDayClient.js") : null;
      const resource = dayClient ? await dayClient.readNutritionState(uid, {
        mode: options.mode || "full", dayKeys: options.dayKeys || [], force: options.force === true
      }) : null;
      const [userSnap, personalMyFoodsSnap] = resource ? [] : await Promise.all([
        getDoc(doc(db, "users", uid, "nutrition", "state")),
        getDoc(getPersonalMyFoodsDocRef(uid))
      ]);
      if (!session.isCurrent() || !isCurrent()) return;
      const storageScope = resource ? { generation: resource.manifest.generation, writerEpoch: resource.manifest.writerEpoch } : null;
      const previousScope = initialLocal?.__nutritionStorage;
      const scopeChanged = Boolean(resource && (previousScope
        ? previousScope.generation !== storageScope.generation || previousScope.writerEpoch !== storageScope.writerEpoch
        : resource.manifest.resetAt));

      const userData = resource ? resource.state : userSnap.exists() ? userSnap.data() : {};
      const personalMyFoodsData = resource ? { myFoods: resource.state.myFoods, deletedMyFoods: resource.state.deletedMyFoods }
        : personalMyFoodsSnap.exists() ? personalMyFoodsSnap.data() : {};
      const remoteNutrition = { ...mergeNutritionStates({}, userData,
        personalMyFoodsData.myFoods || {}, personalMyFoodsData.deletedMyFoods || {}), ...(storageScope ? { __nutritionStorage: storageScope } : {}) };
      const pendingNutrition = getFailedNutritionSync(uid)?.nutrition;
      const localNutrition = safeReadUserJsonStorage(NUTRITION_STORAGE_KEY, uid, {});
      const localUid = localNutrition?.__uid;

      const safeLocalNutrition =
        !scopeChanged && (!localUid || localUid === uid)
          ? localNutrition
          : {};

      const mergedNutrition = mergeNutritionStates(
        mergeNutritionStates(safeLocalNutrition,
          !scopeChanged && pendingNutrition && (!pendingNutrition.__uid || pendingNutrition.__uid === uid) ? pendingNutrition : {}),
        userData,
        personalMyFoodsData.myFoods || {},
        personalMyFoodsData.deletedMyFoods || {}
      );

      const scopedNutrition = {
        ...mergedNutrition,
        __uid: uid,
        ...(storageScope ? { __nutritionStorage: storageScope } : {})
      };

      setNutrition((current) => {
        if (!session.isCurrent() || !isCurrent() || resource && !dayClient.isNutritionManifestCurrent(uid, resource.manifest)) return current;
        // Unrequested cached days are not empty cloud days. Only the snapshot
        // captured before I/O may seed their baseline; concurrent edits remain
        // outside it, and durable pending snapshots still trigger a save.
        const baseline = resource && !scopeChanged && !resource.coverage.complete
          ? mergeNutritionStates(initialLocal?.__uid && initialLocal.__uid !== uid ? {} : initialLocal,
            mergeNutritionStates(initialLocal?.__uid && initialLocal.__uid !== uid ? {} : initialLocal, remoteNutrition))
          : remoteNutrition;
        if (storageScope) baseline.__nutritionStorage = storageScope;
        rememberNutritionCloudState(auth, baseline, { partial: Boolean(resource && !scopeChanged && !resource.coverage.complete) });
        const currentScopeMatches = !storageScope || current?.__nutritionStorage?.generation === storageScope.generation
          && current?.__nutritionStorage?.writerEpoch === storageScope.writerEpoch;
        if (scopeChanged && !currentScopeMatches && current?.updatedAt && !sameNutritionState(current, initialLocal)) {
          const pending = getFailedNutritionSync(uid)?.nutrition;
          const safePending = pending && (!pending.__uid || pending.__uid === uid) ? pending : {};
          const preserved = withNutritionPendingScope({ ...mergeNutritionStates(safePending, current), __uid: uid },
            pending && (!pending.__uid || pending.__uid === uid) ? pending : null);
          if (!sameNutritionState(pending, preserved) && !setFailedNutritionSync(uid, preserved)) {
            showAppError("storage", "Не удалось сохранить изменения перед обновлением дневника. Локальные данные оставлены на экране.");
            return current;
          }
        }
        const safeCurrent = current?.__uid && current.__uid !== uid || scopeChanged && !currentScopeMatches ? {} : current;
        const next = { ...mergeNutritionStates(safeCurrent, scopedNutrition), __uid: uid,
          ...(storageScope ? { __nutritionStorage: storageScope } : {}) };
        persistNutritionLocalSnapshot(NUTRITION_STORAGE_KEY, uid, next);
        // A pending durable mutation must wake the retry effect after reconnect,
        // even when the refreshed cloud data adds no visible fields.
        return !pendingNutrition && sameNutritionState(current, next) ? current : next;
      });

      endPerformanceCheck(NUTRITION_LOAD_LABEL, {
        days: Object.keys(mergedNutrition.days || {}).length,
        myFoods: Object.keys(mergedNutrition.myFoods || {}).length
      });
      if (session.isCurrent() && isCurrent() && (!resource || dayClient.isNutritionManifestCurrent(uid, resource.manifest))) {
        onNutritionCoverageChange?.({ ...requested, loading: false, error: null,
          ...(resource ? { ...resource.coverage, ...resource.manifest } : { complete: true, sourceOfTruth: "legacy",
            loadedDayKeys: Object.keys(mergedNutrition.days || {}), missingDayKeys: [], nextCursor: null }) });
      }
      return resource;
    } catch (error) {
      if (!session.isCurrent() || !isCurrent()) return;
      if (error.code === "nutrition/stale-read") {
        throw error;
      }
      onNutritionCoverageChange?.({ ...requested, loading: false, complete: false, error: error.code || "nutrition/load-failed" });
      console.error("Nutrition load error", error);
      showAppError(
        typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "firebase",
        ERROR_LOAD_NUTRITION
      );
      throw error;
    } finally {
      if (session.isCurrent() && isCurrent()) {
        setNutritionCloudReady((current) => session.isCurrent() && isCurrent() ? true : current);
      }
    }
    }, { force: options.force === true });
    // All callers share the real rejection. Only a compatibility caller turns
    // it into a fallback, so a strict caller cannot inherit a swallowed error.
    return options.throwOnError ? request : request.catch(() => undefined);
  }

  return {
    loadNutritionFromFirebase
  };
}
