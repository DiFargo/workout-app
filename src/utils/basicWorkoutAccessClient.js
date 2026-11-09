import { assertBasicWorkoutAccess } from "../../functions/basicWorkoutAccess.js";
import { captureAuthSession } from "./authSession.js";
import { readOfflineClientProfile } from "./offlineWorkoutAccess.js";

export async function verifyBasicWorkoutAccess({ auth, db }) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Войдите в аккаунт, чтобы проверить доступ.");
  const session = captureAuthSession(auth);
  const offlineProfile = readOfflineClientProfile(uid);
  if (offlineProfile) {
    assertBasicWorkoutAccess(offlineProfile);
    return true;
  }
  const { doc, getDocFromServer } = await import("firebase/firestore");
  if (!session.isCurrent()) throw new Error("Аккаунт изменился. Повторите вход.");
  const snapshot = await getDocFromServer(doc(db, "users", uid));
  if (!session.isCurrent()) throw new Error("Аккаунт изменился. Повторите вход.");
  assertBasicWorkoutAccess(snapshot.exists() ? snapshot.data() : {});
  return true;
}
