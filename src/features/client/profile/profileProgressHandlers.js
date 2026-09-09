import { persistProgressPhotos } from "./progressPhotoPersistence.js";
import { persistMeasurement } from "./measurementPersistence.js";
import { collection, getDocs } from "firebase/firestore";

import { createClientResourceId } from "../../../domain/clientInsights";
import { getAiNutritionGoalLabel } from "../../../utils/aiNutritionLabels";
import { uploadStorageFile } from "../../../utils/firebaseStorage";
import { compressProgressPhoto } from "../../../utils/imageCompression";
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

export function createProfileProgressHandlers({
  MEASUREMENTS_STORAGE_KEY,
  auth,
  db,
  aiNutritionProfile,
  aiNutritionProfileDraft,
  measurementReplayInProgressRef,
  profileMeasurements,
  profileMeasurementDraft,
  profileProgressPhotoFiles,
  recordTrainerEvent,
  showAppError,
  setAiNutritionProfile,
  setAiNutritionProfileDraft,
  setClientProgressPhotos,
  setProfileMeasurementSaving,
  setProfileMeasurements,
  setProfileMeasurementStatus,
  setProfileProgressPhotoFiles,
  setProfileProgressPhotoPreviews,
  setProfileProgressPhotoStatus,
  setProfileProgressPhotoUploading
}) {
  async function loadProfileMeasurements(uid = auth.currentUser?.uid) {
    if (!uid) {
      setProfileMeasurements([]);
      return [];
    }

    const cachedMeasurements = safeReadUserJsonStorage(MEASUREMENTS_STORAGE_KEY, uid, []);
    const normalizedCachedMeasurements = (Array.isArray(cachedMeasurements) ? cachedMeasurements : [])
      .sort((a, b) => getMeasurementTimestampValue(b) - getMeasurementTimestampValue(a));

    if (normalizedCachedMeasurements.length) {
      setProfileMeasurements(normalizedCachedMeasurements);
    }

    try {
      const snapshot = await getDocs(collection(db, "users", uid, "measurements"));
      if (auth.currentUser?.uid !== uid) return [];
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
      setProfileMeasurements(measurements);
      return measurements;
    } catch (error) {
      if (auth.currentUser?.uid !== uid) return [];
      console.error("Ошибка загрузки замеров:", error);
      setProfileMeasurements(normalizedCachedMeasurements);
      return normalizedCachedMeasurements;
    }
  }

  async function loadClientProgressPhotos(uid = auth.currentUser?.uid) {
    if (!uid) {
      setClientProgressPhotos([]);
      return [];
    }

    try {
      const snapshot = await getDocs(collection(db, "users", uid, "progressPhotos"));
      if (auth.currentUser?.uid !== uid) return [];
      const photos = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => (
          getTrainerSummaryTimestamp(b.date || b.createdAt) -
          getTrainerSummaryTimestamp(a.date || a.createdAt)
        ));
      setClientProgressPhotos(photos);
      return photos;
    } catch (error) {
      if (auth.currentUser?.uid !== uid) return [];
      console.warn("Client progress photos load failed:", error);
      setClientProgressPhotos([]);
      return [];
    }
  }

  function selectClientProgressPhoto(view, file) {
    setProfileProgressPhotoFiles((current) => ({ ...current, [view]: file || null }));

    if (!file) {
      setProfileProgressPhotoPreviews((current) => ({ ...current, [view]: "" }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setProfileProgressPhotoPreviews((current) => ({
        ...current,
        [view]: typeof reader.result === "string" ? reader.result : ""
      }));
    };
    reader.readAsDataURL(file);
  }

  async function saveClientProgressPhotos() {
    const uid = auth.currentUser?.uid;
    const requiredViews = ["front", "side", "back"];
    if (!uid) return;

    if (!requiredViews.every((view) => profileProgressPhotoFiles[view])) {
      setProfileProgressPhotoStatus("Добавь фото спереди, сбоку и со спины.");
      return;
    }

    setProfileProgressPhotoUploading(true);
    setProfileProgressPhotoStatus("");

    try {
      const photo = await persistProgressPhotos({ db, uid, files: profileProgressPhotoFiles, upload: uploadStorageFile, compress: compressProgressPhoto, createId: () => createClientResourceId("progress") });
      setClientProgressPhotos((current) => [photo, ...current.filter((item) => item.id !== photo.id)]);
      setProfileProgressPhotoFiles({ front: null, side: null, back: null });
      setProfileProgressPhotoPreviews({ front: "", side: "", back: "" });
      setProfileProgressPhotoStatus("Фото прогресса сохранены.");
      await recordTrainerEvent(uid, "photo", "Клиент добавил фото прогресса")
        .catch((error) => console.warn("Photos saved; trainer event was not recorded", error));
    } catch (error) {
      console.error("Client progress photos upload failed:", error);
      setProfileProgressPhotoStatus("Не получилось загрузить фото. Проверь соединение и попробуй ещё раз.");
    } finally {
      setProfileProgressPhotoUploading(false);
    }
  }

  async function saveProfileMeasurement(draftOverride = null, options = {}) {
    const uid = auth.currentUser?.uid;
    if (!uid) return false;

    const measurementDraft = draftOverride && typeof draftOverride === "object"
      ? draftOverride
      : profileMeasurementDraft;

    const activeGoal = aiNutritionProfileDraft.goal || aiNutritionProfile?.goal || "recomp";
    const fields = getProfileMeasurementFields(activeGoal);
    const draftValidation = validateProfileMeasurementDraft(measurementDraft, fields);

    if (!draftValidation.hasValue) {
      setProfileMeasurementStatus("Заполни хотя бы один замер.");
      return false;
    }

    if (!draftValidation.valid) {
      setProfileMeasurementStatus(draftValidation.firstError);
      return false;
    }

    const normalizedMeasurementDraft = {
      ...measurementDraft,
      ...draftValidation.values
    };

    setProfileMeasurementSaving(true);
    setProfileMeasurementStatus("");

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
    const nextMeasurements = [
      measurement,
      ...(Array.isArray(profileMeasurements) ? profileMeasurements : [])
        .filter((item) => item?.id !== measurementId)
    ].sort((a, b) => getMeasurementTimestampValue(b) - getMeasurementTimestampValue(a));
    const requireCloudSave = options?.requireCloudSave === true;
    const completeFirstSetupVersion = String(options?.completeFirstSetupVersion || "").trim();
    const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;
    const applyLocalMeasurement = (queueForSync = false) => {
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
        setProfileMeasurementStatus("Недостаточно места на устройстве. Замер не сохранён — восстановите сеть и повторите.");
        return false;
      }
      setProfileMeasurements(nextMeasurements);
      safeWriteUserJsonStorage(MEASUREMENTS_STORAGE_KEY, uid, nextMeasurements);
      if (normalizedMeasurementDraft.weight) {
        setAiNutritionProfileDraft((prev) => ({ ...prev, weight: normalizedMeasurementDraft.weight }));
        setAiNutritionProfile((prev) => ({
          ...(prev || {}),
          ...(aiNutritionProfileDraft || {}),
          weight: normalizedMeasurementDraft.weight
        }));
      }
      return true;
    };
    if (isOffline()) {
      setProfileMeasurementSaving(false);
      if (requireCloudSave) {
        setProfileMeasurementStatus("Нет подключения к интернету. Замер не сохранён в облаке — подключитесь и повторите.");
        return false;
      }

      if (!applyLocalMeasurement(true)) return false;
      setProfileMeasurementStatus("Замер сохранён на устройстве. Синхронизирую при появлении сети.");
      return true;
    }

    try {
      await persistMeasurement({ db, uid, item: queuedMeasurement, completeFirstSetupVersion });

      applyLocalMeasurement(false);
      setProfileMeasurementStatus("Замер сохранён. Эти данные можно использовать для коррекции плана.");
    } catch (error) {
      console.error("Ошибка сохранения замера:", error);

      if (!requireCloudSave && isOffline()) {
        if (!applyLocalMeasurement(true)) return false;
        setProfileMeasurementStatus("Замер сохранён на устройстве. Синхронизирую при появлении сети.");
        return true;
      }

      setProfileMeasurementStatus(
        isOffline()
          ? "Нет подключения к интернету. Замер не сохранён в облаке — подключитесь и повторите."
          : "Не удалось сохранить замер в облаке. Проверьте соединение и повторите."
      );
      return false;
    } finally {
      setProfileMeasurementSaving(false);
    }

    return true;
  }

  async function replayFailedMeasurementSaves(uid = auth.currentUser?.uid) {
    if (!uid || measurementReplayInProgressRef.current) return;

    const queue = getFailedMeasurementQueue(uid);
    if (!queue.length) return;

    measurementReplayInProgressRef.current = true;
    let syncedCount = 0;

    try {
      for (const item of queue) {
        try {
          if (!item?.id || !item?.measurement) continue;

          await persistMeasurement({ db, uid, item });
          acknowledgeMeasurementSave(uid, item);

          syncedCount += 1;
        } catch {
          // Keep failed and newly enqueued measurements for the next replay.
        }
      }

      const remaining = getFailedMeasurementQueue(uid);

      if (syncedCount > 0) {
        await loadProfileMeasurements(uid);
        showAppError(
          "savedLocal",
          remaining.length
            ? "Часть локальных замеров синхронизирована."
            : "Локальные замеры синхронизированы."
        );
      }
    } finally {
      measurementReplayInProgressRef.current = false;
    }
  }

  return {
    loadProfileMeasurements,
    loadClientProgressPhotos,
    replayFailedMeasurementSaves,
    selectClientProgressPhoto,
    saveClientProgressPhotos,
    saveProfileMeasurement
  };
}
