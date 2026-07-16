import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { createClientResourceId } from "../../../domain/clientInsights";
import { getAiNutritionGoalLabel } from "../../../utils/aiNutritionLabels";
import { compressProgressPhoto } from "../../../utils/imageCompression";
import {
  getFailedMeasurementQueue,
  setFailedMeasurementQueue
} from "../../../utils/offlineSyncStorage";
import {
  getMeasurementTimestampValue,
  getProfileMeasurementFields
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
  storage,
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
        const photoRef = ref(storage, `progress-photos/${uid}/${photoId}/${view}.webp`);
        await uploadBytes(photoRef, compressed, {
          contentType: "image/webp",
          cacheControl: "public,max-age=31536000,immutable"
        });
        return [`${view}Url`, await getDownloadURL(photoRef)];
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

  async function saveProfileMeasurement() {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const activeGoal = aiNutritionProfileDraft.goal || aiNutritionProfile?.goal || "recomp";
    const fields = getProfileMeasurementFields(activeGoal);
    const hasAnyValue = fields.some((field) => String(profileMeasurementDraft[field.id] || "").trim());

    if (!hasAnyValue) {
      setProfileMeasurementStatus("Заполни хотя бы один замер.");
      return;
    }

    setProfileMeasurementSaving(true);
    setProfileMeasurementStatus("");

    const measurementId = `measurement_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();
    const measurement = {
      ...profileMeasurementDraft,
      id: measurementId,
      clientSaveId: measurementId,
      goal: activeGoal,
      goalLabel: getAiNutritionGoalLabel(activeGoal),
      date: now,
      createdAt: now
    };
    const queuedMeasurement = {
      id: measurementId,
      measurement,
      profileWeight: profileMeasurementDraft.weight || "",
      aiNutritionProfile: profileMeasurementDraft.weight
        ? {
            ...(aiNutritionProfile || {}),
            ...(aiNutritionProfileDraft || {}),
            weight: profileMeasurementDraft.weight
          }
        : null,
      queuedAt: now
    };
    const nextMeasurements = [
      measurement,
      ...(Array.isArray(profileMeasurements) ? profileMeasurements : [])
        .filter((item) => item?.id !== measurementId)
    ].sort((a, b) => getMeasurementTimestampValue(b) - getMeasurementTimestampValue(a));

    setProfileMeasurements(nextMeasurements);
    safeWriteUserJsonStorage(MEASUREMENTS_STORAGE_KEY, uid, nextMeasurements);
    setFailedMeasurementQueue(uid, [
      queuedMeasurement,
      ...getFailedMeasurementQueue(uid).filter((item) => item?.id !== measurementId)
    ]);

    if (profileMeasurementDraft.weight) {
      setAiNutritionProfileDraft((prev) => ({ ...prev, weight: profileMeasurementDraft.weight }));
      setAiNutritionProfile((prev) => ({
        ...(prev || {}),
        ...(aiNutritionProfileDraft || {}),
        weight: profileMeasurementDraft.weight
      }));
    }

    try {
      await setDoc(doc(db, "users", uid, "measurements", measurementId), measurement);

      if (profileMeasurementDraft.weight) {
        await setDoc(doc(db, "users", uid), {
          aiNutritionProfile: queuedMeasurement.aiNutritionProfile,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      setFailedMeasurementQueue(
        uid,
        getFailedMeasurementQueue(uid).filter((item) => item?.id !== measurementId)
      );
      setProfileMeasurementStatus("Замер сохранён. Эти данные можно использовать для коррекции плана.");
    } catch (error) {
      console.error("Ошибка сохранения замера:", error);
      setProfileMeasurementStatus("Замер сохранён на устройстве. Синхронизирую при появлении сети.");
    } finally {
      setProfileMeasurementSaving(false);
    }

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
