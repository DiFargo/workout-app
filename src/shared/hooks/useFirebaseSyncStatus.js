import { useEffect } from "react";

export function useFirebaseSyncStatus({
  onOffline,
  onOnline
}) {
  useEffect(() => {
    const handleOffline = () => {
      onOffline();
    };

    const handleOnline = () => {
      onOnline();
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [onOffline, onOnline]);
}
