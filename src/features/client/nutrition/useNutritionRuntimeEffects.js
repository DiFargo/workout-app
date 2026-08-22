import { useEffect } from "react";

import { saveNutritionStateWithMerge } from "../../../utils/nutritionStateStorage";
import { setFailedNutritionSync } from "../../../utils/offlineSyncStorage";
import {
  addUserLocalBackup,
  removeUserLocalBackup,
  safeWriteUserJsonStorage
} from "../../../utils/userScopedStorage";

export function useNutritionRuntimeEffects({
  auth,
  barcodeScannerOpen,
  barcodeSearchEnabled,
  barcodeVideoRef,
  nutrition,
  nutritionCloudReady,
  nutritionStorageKey,
  nutritionBackupStorageKey,
  nutritionUndoTimerRef,
  user,
  addNutritionFoodFromPicker,
  findFoodByBarcode,
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
    if (!user?.uid || !nutritionCloudReady) return;

    const localNutrition = {
      ...nutrition,
      __uid: user.uid,
      updatedAt: new Date().toISOString()
    };
    const nutritionBackup = { ...localNutrition };
    delete nutritionBackup.myFoods;

    safeWriteUserJsonStorage(nutritionStorageKey, user.uid, localNutrition);
    addUserLocalBackup(nutritionBackupStorageKey, user.uid, { nutrition: nutritionBackup }, 12);
  }, [nutrition, nutritionCloudReady, nutritionBackupStorageKey, nutritionStorageKey, user?.uid]);

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

        if (barcodeVideoRef.current) {
          barcodeVideoRef.current.srcObject = stream;
          await barcodeVideoRef.current.play();
        }

        const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });

        const scan = async () => {
          if (stopped || !barcodeVideoRef.current) return;

          try {
            const codes = await detector.detect(barcodeVideoRef.current);
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

          frameId = requestAnimationFrame(scan);
        };

        scan();
      } catch (error) {
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
  }, [barcodeScannerOpen]);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser || !nutritionCloudReady) return undefined;

    const timer = setTimeout(() => {
      const userNutritionState = { ...nutrition };
      delete userNutritionState.myFoods;
      const backupId = `nutrition_${Date.now()}`;
      const nutritionPayload = {
        ...userNutritionState,
        __uid: currentUser.uid,
        updatedAt: new Date().toISOString()
      };

      addUserLocalBackup(nutritionBackupStorageKey, currentUser.uid, {
        id: backupId,
        nutrition,
        reason: "before_cloud_save"
      });

      saveNutritionStateWithMerge(currentUser.uid, nutritionPayload)
        .then(() => {
          removeUserLocalBackup(nutritionBackupStorageKey, currentUser.uid, backupId);
          setFailedNutritionSync(currentUser.uid, null);
        })
        .catch((error) => {
          console.error("Nutrition save error", error);
          showAppError(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "firebase");
          setFailedNutritionSync(currentUser.uid, nutritionPayload);
          addUserLocalBackup(nutritionBackupStorageKey, currentUser.uid, {
            nutrition: nutritionPayload,
            reason: "cloud_save_failed",
            error: error.message || String(error)
          });
        });
    }, 650);

    return () => clearTimeout(timer);
  }, [auth.currentUser, nutrition, nutritionBackupStorageKey, nutritionCloudReady, showAppError]);
}
