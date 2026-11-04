import { persistProgressPhotos } from "./progressPhotoPersistence.js";
import { persistMeasurement } from "./measurementPersistence.js";
import { collection, getDocs } from "firebase/firestore";

import { createClientResourceId } from "../../../domain/clientInsights";
import { getAiNutritionGoalLabel } from "../../../utils/aiNutritionLabels";
import { uploadStorageFile } from "../../../utils/firebaseStorage";
import { compressProgressPhoto } from "../../../utils/imageCompression";
import { captureAuthSession as captureActiveAuthSession } from "../../../utils/authSession.js";
import { validateClientLoadingSnapshot } from "../../../utils/clientLoadingSnapshot.js";
import {
  getFailedMeasurementQueue,
  acknowledgeMeasurementSave,
  setFailedMeasurementQueue
} from "../../../utils/offlineSyncStorage";
import {
  getMeasurementTimestampValue,
  getProfileMeasurementFields,
  validateProfileMeasurementDraft
} from "../../../utils/profileMeasurements";
import { getTrainerSummaryTimestamp } from "../../../utils/trainerSummaryDates";
import {
  safeReadUserJsonStorage,
  safeWriteUserJsonStorage
} from "../../../utils/userScopedStorage";

const photoReadersBySetter = new WeakMap();
const measurementSnapshotLoads = new WeakMap();

export function createProfileProgressHandlers({
  MEASUREMENTS_STORAGE_KEY,
  auth,
  captureAuthSession = () => captureActiveAuthSession(auth),
  db,
  aiNutritionProfile,
  aiNutritionProfileDraft,
  measurementReplayInProgressRef,
  profileMeasurements,
  profileMeasurementDraft,
  profileProgressPhotoFiles,
  readClientLoadingSnapshot,
  recordTrainerEvent,
  showAppError,
  setAiNutritionProfile,
  setAiNutritionProfileDraft,
  setClientProgressPhotos,
  setProfileMeasurementSaving,
  setProfileMeasurements,
  setProfileMeasurementSnapshot,
  setProfileMeasurementStatus,
  setProfileProgressPhotoFiles,
  setProfileProgressPhotoPreviews,
  setProfileProgressPhotoStatus,
  setProfileProgressPhotoUploading
}) {
  function updateForSession(session, setter, value) {
    if (!session.isCurrent()) return;
    setter((current) => session.isCurrent()
      ? (typeof value === "function" ? value(current) : value)
      : current);
  }

  // This metadata has a separate destination: recent7 is never a full history.
  async function loadProfileMeasurementSnapshot(uid = auth.currentUser?.uid, { throwOnError = false } = {}) {
    const session = captureAuthSession();
    if (!uid || session.uid !== uid || !session.isCurrent() ||
      typeof readClientLoadingSnapshot !== "function" || typeof setProfileMeasurementSnapshot !== "function") return null;
    const generation = (measurementSnapshotLoads.get(setProfileMeasurementSnapshot) || 0) + 1;
    measurementSnapshotLoads.set(setProfileMeasurementSnapshot, generation);
    const isCurrent = () => session.isCurrent() && measurementSnapshotLoads.get(setProfileMeasurementSnapshot) === generation;
    try {
      const snapshot = validateClientLoadingSnapshot(await readClientLoadingSnapshot({ kind: "measurements" }), "measurements", uid);
      if (!isCurrent()) return null;
      setProfileMeasurementSnapshot(current => isCurrent() ? snapshot : current);
      return snapshot;
    } catch (error) {
      if (isCurrent()) console.warn("Measurement overview snapshot load failed:", error);
      if (isCurrent() && throwOnError) throw error;
      return null;
    }
  }

  async function loadProfileMeasurements(uid = auth.currentUser?.uid) {
    const session = captureAuthSession();
    if (session.uid !== uid) return [];
    if (!uid) {
      updateForSession(session, setProfileMeasurements, []);
      return [];
    }

    const cachedMeasurements = safeReadUserJsonStorage(MEASUREMENTS_STORAGE_KEY, uid, []);
    const normalizedCachedMeasurements = (Array.isArray(cachedMeasurements) ? cachedMeasurements : [])
      .sort((a, b) => getMeasurementTimestampValue(b) - getMeasurementTimestampValue(a));

    if (normalizedCachedMeasurements.length) {
      updateForSession(session, setProfileMeasurements, normalizedCachedMeasurements);
    }

    try {
      const snapshot = await getDocs(collection(db, "users", uid, "measurements"));
      if (!session.isCurrent()) return [];
      const remoteMeasurements = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      const measurements = Array.from(
        new Map(
          [...normalizedCachedMeasurements, ...remoteMeasurements]
            .filter((item) => item?.id)
            .map((item) => [item.id, item])
        ).values()
      )
        .sort((a, b) => getMeasurementTimestampValue(b) - getMeasurementTimestampValue(a));

      safeWriteUserJsonStorage(MEASUREMENTS_STORAGE_KEY, uid, measurements);
      updateForSession(session, setProfileMeasurements, measurements);
      return measurements;
    } catch (error) {
      if (!session.isCurrent()) return [];
      console.error("Ошибка загрузки замеров:", error);
      updateForSession(session, setProfileMeasurements, normalizedCachedMeasurements);
      return normalizedCachedMeasurements;
    }
  }

  async function loadClientProgressPhotos(uid = auth.currentUser?.uid, { throwOnError = false } = {}) {
    const session = captureAuthSession();
    if (session.uid !== uid) return [];
    if (!uid) {
      updateForSession(session, setClientProgressPhotos, []);
      return [];
    }

    try {
      const snapshot = await getDocs(collection(db, "users", uid, "progressPhotos"));
      if (!session.isCurrent()) return [];
      const photos = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => (
          getTrainerSummaryTimestamp(b.date || b.createdAt) -
          getTrainerSummaryTimestamp(a.date || a.createdAt)
        ));
      updateForSession(session, setClientProgressPhotos, photos);
      return photos;
    } catch (error) {
      if (!session.isCurrent()) return [];
      console.warn("Client progress photos load failed:", error);
      if (throwOnError) throw error;
      updateForSession(session, setClientProgressPhotos, []);
      return [];
    }
  }

  function selectClientProgressPhoto(view, file) {
    const session = captureAuthSession();
    let readers = photoReadersBySetter.get(setProfileProgressPhotoFiles);
    if (!readers) {
      readers = new Map();
      photoReadersBySetter.set(setProfileProgressPhotoFiles, readers);
    }
    const previous = readers.get(view);
    const selection = { file, reader: null };
    readers.set(view, selection);
    if (previous?.reader?.readyState === 1) previous.reader.abort();
    const isCurrent = () => session.isCurrent() && readers.get(view) === selection;
    updateForSession(session, setProfileProgressPhotoFiles, (current) => isCurrent() ? ({ ...current, [view]: file || null }) : current);

    if (!file) {
      updateForSession(session, setProfileProgressPhotoPreviews, (current) => isCurrent() ? ({ ...current, [view]: "" }) : current);
      return;
    }

    const reader = new FileReader();
    selection.reader = reader;
    reader.onload = () => {
      if (!isCurrent()) return;
      updateForSession(session, setProfileProgressPhotoPreviews, (current) => isCurrent() ? ({
        ...current,
        [view]: typeof reader.result === "string" ? reader.result : ""
      }) : current);
    };
    reader.readAsDataURL(file);
  }

  async function saveClientProgressPhotos() {
    const session = captureAuthSession();
    const uid = session.uid;
    const requiredViews = ["front", "side", "back"];
    if (!uid) return;

    if (!requiredViews.every((view) => profileProgressPhotoFiles[view])) {
      updateForSession(session, setProfileProgressPhotoStatus, "Добавь фото спереди, сбоку и со спины.");
      return;
    }

    updateForSession(session, setProfileProgressPhotoUploading, true);
    updateForSession(session, setProfileProgressPhotoStatus, "");

    try {
      const photo = await persistProgressPhotos({ db, uid, files: profileProgressPhotoFiles, upload: uploadStorageFile, compress: compressProgressPhoto, createId: () => createClientResourceId("progress") });
      if (!session.isCurrent()) return false;
      const readers = photoReadersBySetter.get(setProfileProgressPhotoFiles);
      if (readers) {
        for (const selection of readers.values()) if (selection.reader?.readyState === 1) selection.reader.abort();
        readers.clear();
      }
      updateForSession(session, setClientProgressPhotos, (current) => [photo, ...current.filter((item) => item.id !== photo.id)]);
      updateForSession(session, setProfileProgressPhotoFiles, { front: null, side: null, back: null });
      updateForSession(session, setProfileProgressPhotoPreviews, { front: "", side: "", back: "" });
      updateForSession(session, setProfileProgressPhotoStatus, "Фото прогресса сохранены.");
      await recordTrainerEvent(uid, "photo", "Клиент добавил фото прогресса")
        .catch((error) => console.warn("Photos saved; trainer event was not recorded", error));
    } catch (error) {
      console.error("Client progress photos upload failed:", error);
      updateForSession(session, setProfileProgressPhotoStatus, "Не получилось загрузить фото. Проверь соединение и попробуй ещё раз.");
    } finally {
      updateForSession(session, setProfileProgressPhotoUploading, false);
    }
  }

  async function saveProfileMeasurement(draftOverride = null, options = {}) {
    const session = captureAuthSession();
    const uid = session.uid;
    if (!uid) return false;

    const measurementDraft = draftOverride && typeof draftOverride === "object"
      ? draftOverride
      : profileMeasurementDraft;

    const activeGoal = aiNutritionProfileDraft.goal || aiNutritionProfile?.goal || "recomp";
    const fields = getProfileMeasurementFields(activeGoal);
    const draftValidation = validateProfileMeasurementDraft(measurementDraft, fields);

    if (!draftValidation.hasValue) {
      updateForSession(session, setProfileMeasurementStatus, "Заполни хотя бы один замер.");
      return false;
    }

    if (!draftValidation.valid) {
      updateForSession(session, setProfileMeasurementStatus, draftValidation.firstError);
      return false;
    }

    const normalizedMeasurementDraft = {
      ...measurementDraft,
      ...draftValidation.values
    };

    updateForSession(session, setProfileMeasurementSaving, true);
    updateForSession(session, setProfileMeasurementStatus, "");

    const measurementId = `measurement_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();
    const measurement = {
      ...normalizedMeasurementDraft,
      id: measurementId,
      clientSaveId: measurementId,
      measurementType: options?.measurementType === "weight_checkin"
        ? "weight_checkin"
        : "body_measurement",
      goal: activeGoal,
      goalLabel: getAiNutritionGoalLabel(activeGoal),
      date: now,
      createdAt: now
    };
    const queuedMeasurement = {
      id: measurementId,
      measurement,
      profileWeight: normalizedMeasurementDraft.weight || "",
      aiNutritionProfile: normalizedMeasurementDraft.weight
        ? {
            ...(aiNutritionProfile || {}),
            ...(aiNutritionProfileDraft || {}),
            weight: normalizedMeasurementDraft.weight
          }
        : null,
      queuedAt: now
    };
    const requireCloudSave = options?.requireCloudSave === true;
    const completeFirstSetupVersion = String(options?.completeFirstSetupVersion || "").trim();
    const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;
    const applyLocalMeasurement = (queueForSync = false) => {
      if (!session.isCurrent()) return false;
      const queued = setFailedMeasurementQueue(
        uid,
        queueForSync
          ? [
              queuedMeasurement,
              ...getFailedMeasurementQueue(uid).filter((item) => item?.id !== measurementId)
            ]
          : getFailedMeasurementQueue(uid).filter((item) => item?.id !== measurementId)
      );

      if (!queued && queueForSync) {
        updateForSession(session, setProfileMeasurementStatus, "Недостаточно места на устройстве. Замер не сохранён — восстановите сеть и повторите.");
        return false;
      }
      // A request started before this save must not replace the new overview.
      if (typeof setProfileMeasurementSnapshot === "function") {
        measurementSnapshotLoads.set(setProfileMeasurementSnapshot, (measurementSnapshotLoads.get(setProfileMeasurementSnapshot) || 0) + 1);
      }
      updateForSession(session, setProfileMeasurements, (current) => {
        const nextMeasurements = [measurement, ...(Array.isArray(current) ? current : profileMeasurements || [])
          .filter((item) => item?.id !== measurementId)]
          .sort((a, b) => getMeasurementTimestampValue(b) - getMeasurementTimestampValue(a));
        safeWriteUserJsonStorage(MEASUREMENTS_STORAGE_KEY, uid, nextMeasurements);
        return nextMeasurements;
      });
      if (normalizedMeasurementDraft.weight) {
        updateForSession(session, setAiNutritionProfileDraft, (prev) => ({ ...prev, weight: normalizedMeasurementDraft.weight }));
        updateForSession(session, setAiNutritionProfile, (prev) => ({
          ...(prev || {}),
          ...(aiNutritionProfileDraft || {}),
          weight: normalizedMeasurementDraft.weight
        }));
      }
      return true;
    };
    if (isOffline()) {
      updateForSession(session, setProfileMeasurementSaving, false);
      if (requireCloudSave) {
        updateForSession(session, setProfileMeasurementStatus, "Нет подключения к интернету. Замер не сохранён в облаке — подключитесь и повторите.");
        return false;
      }

      if (!applyLocalMeasurement(true)) return false;
      updateForSession(session, setProfileMeasurementStatus, "Замер сохранён на устройстве. Синхронизирую при появлении сети.");
      return true;
    }

    try {
      await persistMeasurement({ db, uid, item: queuedMeasurement, completeFirstSetupVersion });
      if (!session.isCurrent()) return false;
      applyLocalMeasurement(false);
      updateForSession(session, setProfileMeasurementStatus, "Замер сохранён. Эти данные можно использовать для коррекции плана.");
    } catch (error) {
      console.error("Ошибка сохранения замера:", error);
      if (!session.isCurrent()) return false;

      if (!requireCloudSave && isOffline()) {
        if (!applyLocalMeasurement(true)) return false;
        updateForSession(session, setProfileMeasurementStatus, "Замер сохранён на устройстве. Синхронизирую при появлении сети.");
        return true;
      }

      updateForSession(session, setProfileMeasurementStatus,
        isOffline()
          ? "Нет подключения к интернету. Замер не сохранён в облаке — подключитесь и повторите."
          : "Не удалось сохранить замер в облаке. Проверьте соединение и повторите."
      );
      return false;
    } finally {
      updateForSession(session, setProfileMeasurementSaving, false);
    }

    return true;
  }

  async function replayFailedMeasurementSaves(uid = auth.currentUser?.uid) {
    const session = captureAuthSession();
    if (!uid || uid !== session.uid || measurementReplayInProgressRef.current?.isCurrent?.()) return;

    const queue = getFailedMeasurementQueue(uid);
    if (!queue.length) return;

    measurementReplayInProgressRef.current = session;
    let syncedCount = 0;

    try {
      for (const item of queue) {
        if (!session.isCurrent()) return;
        try {
          if (!item?.id || !item?.measurement) continue;

          await persistMeasurement({ db, uid, item });
          if (!session.isCurrent()) return;
          acknowledgeMeasurementSave(uid, item);

          syncedCount += 1;
        } catch {
          // Keep failed and newly enqueued measurements for the next replay.
        }
      }

      const remaining = getFailedMeasurementQueue(uid);

      if (syncedCount > 0) {
        await loadProfileMeasurements(uid);
        if (!session.isCurrent()) return;
        showAppError(
          "savedLocal",
          remaining.length
            ? "Часть локальных замеров синхронизирована."
            : "Локальные замеры синхронизированы."
        );
      }
    } finally {
      if (measurementReplayInProgressRef.current === session) measurementReplayInProgressRef.current = false;
    }
  }

  return {
    loadProfileMeasurementSnapshot,
    loadProfileMeasurements,
    loadClientProgressPhotos,
    replayFailedMeasurementSaves,
    selectClientProgressPhoto,
    saveClientProgressPhotos,
    saveProfileMeasurement
  };
}
