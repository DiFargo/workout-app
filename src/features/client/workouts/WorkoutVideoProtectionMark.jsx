import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../../firebase.js";

function getUserLabel(user) {
  const firstName = String(user?.displayName || "").trim().split(/\s+/)[0];
  if (firstName) return firstName;

  const shortId = String(user?.uid || "").slice(-5).toUpperCase();
  return shortId ? `ID ${shortId}` : "КЛИЕНТ";
}

export default function WorkoutVideoProtectionMark({ className }) {
  const [userLabel, setUserLabel] = useState(() => getUserLabel(auth.currentUser));

  useEffect(() => onAuthStateChanged(auth, (user) => {
    setUserLabel(getUserLabel(user));
  }), []);

  return (
    <span className={className} aria-hidden="true" data-testid="workout-video-watermark">
      ZMENA · {userLabel}
    </span>
  );
}
