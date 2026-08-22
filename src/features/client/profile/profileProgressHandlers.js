import { collection, doc, getDocs, setDoc } from "firebase/firestore";

import { createClientResourceId } from "../../../domain/clientInsights";
import { getAiNutritionGoalLabel } from "../../../utils/aiNutritionLabels";
import { uploadStorageFile } from "../../../utils/firebaseStorage";
import { compressProgressPhoto } from "../../../utils/imageCompression";
import {
  getFailedMeasurementQueue,
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
  APP_PAGES,
  MEASUREMENTS_STORAGE_KEY,
  auth,
  db,
  aiNutritionProfile,
  aiNutritionProfileDraft,
  measurementReplayInProgressRef,
  profileMeasurements,
  profileMeasurementDraft,
  profileMeasurementReturnTab,
  profileProgressPhotoFiles,
  recordTrainerEvent,
  showAppError,
  setAiNutritionProfile,
  setAiNutritionProfileDraft,
  setClientProgressPhotos,
  setPage,
  setProfileActiveTab,
  setProfileMeasurementDraft,
  setProfileMeasurementOpen,
  setProfileMeasurementSaving,
  setProfileMeasurements,
  setProfileMeasurementStatus,
  setProfileMeasurementWizardStep,
  setProfileProgressPhotoFiles,
  setProfileProgressPhotoPreviews,
  setProfileProgressPhotosModalOpen,
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
    const photoId = createClientResourceId("progress");

    try {
      const uploadedEntries = await Promise.all(requiredViews.map(async (view) => {
        const compressed = await compressProgressPhoto(profileProgressPhotoFiles[view]);
        const uploadedPhoto = await uploadStorageFile(`progress-photos/${uid}/${photoId}/${view}.webp`, compressed, {
          contentType: "image/webp",
          cacheControl: "public,max-age=31536000,immutable"
        });
        return [`${view}Url`, uploadedPhoto.url];
      }));
      const photoUrls = Object.fromEntries(uploadedEntries);
      const now = new Date().toISOString();
      const photo = {
        date: now.slice(0, 10),
        ...photoUrls,
        createdAt: now,
        createdByUid: uid,
        createdByRole: "client",
        source: "client"
      };

      await setDoc(doc(db, "users", uid, "progressPhotos", photoId), photo);
      setClientProgressPhotos((current) => [{ id: photoId, ...photo }, ...current]);
      setProfileProgressPhotoFiles({ front: null, side: null, back: null });
      setProfileProgressPhotoPreviews({ front: "", side: "", back: "" });
      setProfileProgressPhotoStatus("Фото прогресса сохранены.");
      await recordTrainerEvent(uid, "photo", "Клиент добавил фото прогресса");
      setProfileProgressPhotosModalOpen(false);
      setProfileProgressPhotoStatus("");
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
      setProfileMeasurements(nextMeasurements);
      safeWriteUserJsonStorage(MEASUREMENTS_STORAGE_KEY, uid, nextMeasurements);
      setFailedMeasurementQueue(
        uid,
        queueForSync
          ? [
              queuedMeasurement,
              ...getFailedMeasurementQueue(uid).filter((item) => item?.id !== measurementId)
            ]
          : getFailedMeasurementQueue(uid).filter((item) => item?.id !== measurementId)
      );

      if (normalizedMeasurementDraft.weight) {
        setAiNutritionProfileDraft((prev) => ({ ...prev, weight: normalizedMeasurementDraft.weight }));
        setAiNutritionProfile((prev) => ({
          ...(prev || {}),
          ...(aiNutritionProfileDraft || {}),
          weight: normalizedMeasurementDraft.weight
        }));
      }
    };
    const closeSavedMeasurement = () => {
      setProfileMeasurementDraft({
        weight: "",
        neck: "",
        shoulders: "",
        chest: "",
        biceps: "",
        forearm: "",
        wrist: "",
        belly: "",
        pelvis: "",
        thigh: "",
        calf: "",
        ankle: "",
        note: ""
      });
      setProfileMeasurementWizardStep(0);
      setProfileMeasurementOpen(false);
      setProfileActiveTab(profileMeasurementReturnTab);
      setPage(APP_PAGES.PROFILE);
    };

    if (isOffline()) {
      setProfileMeasurementSaving(false);
      if (requireCloudSave) {
        setProfileMeasurementStatus("Нет подключения к интернету. Замер не сохранён в облаке — подключитесь и повторите.");
        return false;
      }

      applyLocalMeasurement(true);
      setProfileMeasurementStatus("Замер сохранён на устройстве. Синхронизирую при появлении сети.");
      closeSavedMeasurement();
      return true;
    }

    try {
      await setDoc(doc(db, "users", uid, "measurements", measurementId), measurement);

      if (normalizedMeasurementDraft.weight) {
        await setDoc(doc(db, "users", uid), {
          aiNutritionProfile: queuedMeasurement.aiNutritionProfile,
          ...(completeFirstSetupVersion ? {
            firstSetupCompleted: true,
            firstSetupCompletedVersion: completeFirstSetupVersion,
            firstSetupCompletedAt: new Date().toISOString()
          } : {}),
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      applyLocalMeasurement(false);
      setProfileMeasurementStatus("Замер сохранён. Эти данные можно использовать для коррекции плана.");
    } catch (error) {
      console.error("Ошибка сохранения замера:", error);

      if (!requireCloudSave && isOffline()) {
        applyLocalMeasurement(true);
        setProfileMeasurementStatus("Замер сохранён на устройстве. Синхронизирую при появлении сети.");
        closeSavedMeasurement();
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

    closeSavedMeasurement();
    return true;
  }

  async function replayFailedMeasurementSaves(uid = auth.currentUser?.uid) {
    if (!uid || measurementReplayInProgressRef.current) return;

    const queue = getFailedMeasurementQueue(uid);
    if (!queue.length) return;

    measurementReplayInProgressRef.current = true;
    const remaining = [];
    let syncedCount = 0;

    try {
      for (const item of queue) {
        try {
          if (!item?.id || !item?.measurement) continue;

          await setDoc(doc(db, "users", uid, "measurements", item.id), item.measurement);

          if (item.aiNutritionProfile) {
            await setDoc(doc(db, "users", uid), {
              aiNutritionProfile: item.aiNutritionProfile,
              updatedAt: new Date().toISOString()
            }, { merge: true });
          }

          syncedCount += 1;
        } catch {
          remaining.push(item);
        }
      }

      setFailedMeasurementQueue(uid, remaining);

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
