import { useEffect } from "react";

export function useProfileUiEffects({
  cabinetWorkoutHistoryItemRefs,
  clientProgressPhotos,
  historyLength,
  historyLoading,
  openHistoryKey,
  profileProgressPhotosModalOpen,
  profileWorkoutHistoryModalOpen,
  setProfileProgressPhotoCompareIds
}) {
  useEffect(() => {
    if (!profileWorkoutHistoryModalOpen || !openHistoryKey || historyLoading) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      cabinetWorkoutHistoryItemRefs.current.get(openHistoryKey)?.scrollIntoView({
        block: "start",
        behavior: "smooth"
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [profileWorkoutHistoryModalOpen, openHistoryKey, historyLoading, historyLength]);

  useEffect(() => {
    if (!profileProgressPhotosModalOpen || clientProgressPhotos.length < 2) return;

    setProfileProgressPhotoCompareIds((current) => {
      const availableIds = new Set(clientProgressPhotos.map((photo) => photo.id));
      const firstId = availableIds.has(current[0]) ? current[0] : clientProgressPhotos[1]?.id || "";
      let secondId = availableIds.has(current[1]) ? current[1] : clientProgressPhotos[0]?.id || "";

      if (firstId === secondId) {
        secondId = clientProgressPhotos.find((photo) => photo.id !== firstId)?.id || "";
      }

      return [firstId, secondId];
    });
  }, [profileProgressPhotosModalOpen, clientProgressPhotos]);
}
