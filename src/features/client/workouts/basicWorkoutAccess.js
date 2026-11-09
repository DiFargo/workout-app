import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../../../firebase.js";
import { hasBasicWorkoutAccess } from "../../../../functions/basicWorkoutAccess.js";
import { readOfflineClientProfile } from "../../../utils/offlineWorkoutAccess.js";

export function useBasicWorkoutAccess(enabled = true) {
  const uid = auth.currentUser?.uid || "";
  const [state, setState] = useState({ uid: "", allowed: false, loading: true });
  useEffect(() => {
    if (!enabled || !uid) return undefined;
    return onSnapshot(doc(db, "users", uid), snapshot => {
      if (auth.currentUser?.uid !== uid) return;
      setState({ uid, allowed: hasBasicWorkoutAccess(snapshot.exists() ? snapshot.data() : {}), loading: false });
    }, () => setState({ uid, allowed: false, loading: false }));
  }, [enabled, uid]);
  const offlineProfile = readOfflineClientProfile(uid);
  if (offlineProfile) return { allowed: hasBasicWorkoutAccess(offlineProfile), loading: false };
  return state.uid === uid && uid ? state : { allowed: false, loading: Boolean(uid) };
}
