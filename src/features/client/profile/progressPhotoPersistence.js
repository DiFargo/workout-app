import { doc, setDoc } from "firebase/firestore";
import { safeReadUserJsonStorage, safeWriteUserJsonStorage } from "../../../utils/userScopedStorage.js";
import { toWorkoutDateKey } from "../../../utils/workoutSchedule.js";

const SESSION_KEY = "workout_progress_photos_pending_v1";
const activeSaves = new Map();

export function persistProgressPhotos(args) {
  if (activeSaves.has(args.uid)) return activeSaves.get(args.uid);
  const save = savePhotos(args).finally(() => activeSaves.delete(args.uid));
  activeSaves.set(args.uid, save);
  return save;
}

async function savePhotos({ db, uid, files, upload, compress, createId }) {
  const session = safeReadUserJsonStorage(SESSION_KEY, uid, null) || { id: createId(), createdAt: new Date().toISOString(), uploads: {} };
  if (!safeWriteUserJsonStorage(SESSION_KEY, uid, session)) throw new Error("photo-session-storage-full");
  const results = await Promise.allSettled(["front", "side", "back"].map(async (view) => {
    const file = files[view];
    const signature = `${file.name}:${file.size}:${file.lastModified}`;
    if (session.uploads[view]?.signature === signature) return;
    const compressed = await compress(file);
    const uploaded = await upload(`progress-photos/${uid}/${session.id}/${view}.webp`, compressed, { contentType: "image/webp", cacheControl: "private,no-store,max-age=0" });
    session.uploads[view] = { signature, url: uploaded.url };
    if (!safeWriteUserJsonStorage(SESSION_KEY, uid, session)) throw new Error("photo-session-storage-full");
  }));
  const failure = results.find((result) => result.status === "rejected");
  if (failure) throw failure.reason;
  const photo = {
    date: toWorkoutDateKey(session.createdAt),
    createdAt: session.createdAt, createdByUid: uid, createdByRole: "client", source: "client",
    ...Object.fromEntries(["front", "side", "back"].map((view) => [`${view}Url`, session.uploads[view].url]))
  };
  await setDoc(doc(db, "users", uid, "progressPhotos", session.id), photo);
  safeWriteUserJsonStorage(SESSION_KEY, uid, null);
  return { id: session.id, ...photo };
}
