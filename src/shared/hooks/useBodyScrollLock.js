import { useEffect } from "react";

export function useBodyScrollLock(locked, { lockHtml = false } = {}) {
  useEffect(() => {
    if (!locked) return undefined;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    if (lockHtml) {
      document.documentElement.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      if (lockHtml) {
        document.documentElement.style.overflow = previousHtmlOverflow;
      }
    };
  }, [locked, lockHtml]);
}
