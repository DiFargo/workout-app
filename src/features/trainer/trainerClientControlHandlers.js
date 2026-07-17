import { doc, setDoc } from "firebase/firestore";

import {
  createClientResourceId,
  getClientPaymentAttention
} from "../../domain/clientInsights";
import { uploadStorageFile } from "../../utils/firebaseStorage";
import { compressProgressPhoto } from "../../utils/imageCompression";

export function createTrainerClientControlHandlers({
  auth,
  db,
  adminSelectedClient,
  adminPaymentDraft,
  adminProgressPhotoFiles,
  adminProgressPhotoDate,
  adminProgressPhotoComment,
  setAdminClientPayment,
  setAdminClientProgressPhotos,
  setAdminPhotoCompareIds,
  setAdminProgressPhotoFiles,
  setAdminProgressPhotoComment,
  setAdminProgressPhotoUploading,
  setAdminClientStatus,
  recordTrainerEvent
}) {
  async function saveAdminClientPayment() {
    const clientId = adminSelectedClient?.id;
    if (!clientId) return;

    const payment = {
      ...adminPaymentDraft,
      updatedAt: new Date().toISOString(),
      updatedByUid: auth.currentUser?.uid || ""
    };

    let previousPayment = null;
    setAdminClientPayment((prev) => {
      previousPayment = prev;
      return payment;
    });
    setAdminClientStatus("\u041a\u043e\u043d\u0442\u0440\u043e\u043b\u044c \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u044b \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d.");

    try {
      await setDoc(doc(db, "users", clientId, "payments", "current"), payment, { merge: true });
      recordTrainerEvent(clientId, "programControl", "\u041a\u043e\u043d\u0442\u0440\u043e\u043b\u044c \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u044b \u043e\u0431\u043d\u043e\u0432\u043b\u0451\u043d", getClientPaymentAttention(payment).label);
    } catch (error) {
      console.error("Client program control save failed:", error);
      setAdminClientPayment(previousPayment);
      setAdminClientStatus("\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043a\u043e\u043d\u0442\u0440\u043e\u043b\u044c \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u044b.");
    }
  }

  async function uploadAdminProgressPhotos() {
    const clientId = adminSelectedClient?.id;
    const selectedFiles = Object.entries(adminProgressPhotoFiles).filter(([, file]) => file);
    if (!clientId || !selectedFiles.length) {
      setAdminClientStatus("\u0412\u044b\u0431\u0435\u0440\u0438 \u0445\u043e\u0442\u044f \u0431\u044b \u043e\u0434\u043d\u043e \u0444\u043e\u0442\u043e \u043f\u0440\u043e\u0433\u0440\u0435\u0441\u0441\u0430.");
      return;
    }

    setAdminProgressPhotoUploading(true);
    const photoId = createClientResourceId("progress");

    try {
      const photoUrls = {};
      for (const [view, file] of selectedFiles) {
        const compressed = await compressProgressPhoto(file);
        const uploadedPhoto = await uploadStorageFile(`progress-photos/${clientId}/${photoId}/${view}.webp`, compressed, {
          contentType: "image/webp",
          cacheControl: "public,max-age=31536000,immutable"
        });
        photoUrls[`${view}Url`] = uploadedPhoto.url;
      }

      const photo = {
        date: adminProgressPhotoDate || new Date().toISOString().slice(0, 10),
        comment: adminProgressPhotoComment.trim(),
        ...photoUrls,
        createdAt: new Date().toISOString(),
        createdByUid: auth.currentUser?.uid || ""
      };
      await setDoc(doc(db, "users", clientId, "progressPhotos", photoId), photo);
      const nextPhoto = { id: photoId, ...photo };
      setAdminClientProgressPhotos((current) => [nextPhoto, ...current]);
      setAdminPhotoCompareIds((current) => [photoId, current[0] || ""]);
      setAdminProgressPhotoFiles({ front: null, side: null, back: null });
      setAdminProgressPhotoComment("");
      setAdminClientStatus("\u0424\u043e\u0442\u043e \u043f\u0440\u043e\u0433\u0440\u0435\u0441\u0441\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u044b.");
      recordTrainerEvent(clientId, "photo", "\u0414\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u044b \u0444\u043e\u0442\u043e \u043f\u0440\u043e\u0433\u0440\u0435\u0441\u0441\u0430", photo.comment);
    } catch (error) {
      console.error("Progress photos upload failed:", error);
      setAdminClientStatus("\u041d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0444\u043e\u0442\u043e \u043f\u0440\u043e\u0433\u0440\u0435\u0441\u0441\u0430.");
    } finally {
      setAdminProgressPhotoUploading(false);
    }
  }

  return {
    saveAdminClientPayment,
    uploadAdminProgressPhotos
  };
}
