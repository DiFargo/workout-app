import { useEffect, useRef } from "react";
import { registerModalBackLayer } from "./modalBackNavigation.js";

export function useModalBackNavigation({ open, onBack }) {
  const callback = useRef(onBack);
  useEffect(() => { callback.current = onBack; }, [onBack]);
  useEffect(() => {
    if (!open) return undefined;
    return registerModalBackLayer(() => callback.current?.());
  }, [open]);
}
