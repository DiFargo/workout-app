import { useEffect, useState } from "react";
import { getIdTokenResult } from "firebase/auth";

// Presentation only. The handler reads the SDK token again and the server
// remains responsible for identity, revocation, access and recent-login checks.
export function useProfileEmailAuthMethod(authUser) {
  const [resolved, setResolved] = useState(null);
  useEffect(() => {
    if (!authUser) return undefined;
    let active = true;
    getIdTokenResult(authUser).then(result => {
      if (active) setResolved({ user: authUser, method: result.signInProvider === "custom" ? "custom" : "standard" });
    }).catch(() => {
      if (active) setResolved({ user: authUser, method: "unavailable" });
    });
    return () => { active = false; };
  }, [authUser]);
  if (!authUser) return "standard";
  return resolved?.user === authUser ? resolved.method : "checking";
}
