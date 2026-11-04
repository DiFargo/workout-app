import { app } from "../firebase";

let storageServicesPromise;

function loadStorageServices() {
  if (!storageServicesPromise) {
    storageServicesPromise = import("firebase/storage").then((storageModule) => ({
      storage: storageModule.getStorage(app),
      getDownloadURL: storageModule.getDownloadURL,
      ref: storageModule.ref,
      uploadBytes: storageModule.uploadBytes
    }));
  }

  return storageServicesPromise;
}

export async function uploadStorageFile(path, file, metadata) {
  const { storage, getDownloadURL, ref, uploadBytes } = await loadStorageServices();
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file, metadata);

  const protectedVideo = /^(?:exercise-videos|template-exercise-videos)\//.test(path) ||
    /^basic-exercise-assets\/[^/]+\/videos\//.test(path);
  const privateProgressPhoto = /^progress-photos\/[^/]+\/[^/]+\/[^/]+$/.test(path);
  return {
    path: storageRef.fullPath,
    url: protectedVideo || privateProgressPhoto ? `gs://${storageRef.bucket}/${storageRef.fullPath}` : await getDownloadURL(storageRef)
  };
}
