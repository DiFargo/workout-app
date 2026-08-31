import { useEffect } from "react";

let lockDepth = 0;
let scrollPosition = 0;
let savedStyles = null;

export function useBodyScrollLock(locked, { lockHtml = false } = {}) {
  useEffect(() => {
    if (!locked || typeof document === "undefined") return undefined;

    const body = document.body;
    const html = document.documentElement;

    if (lockDepth === 0) {
      scrollPosition = window.scrollY || window.pageYOffset || 0;
      savedStyles = {
        bodyOverflow: body.style.overflow,
        bodyPosition: body.style.position,
        bodyTop: body.style.top,
        bodyLeft: body.style.left,
        bodyWidth: body.style.width,
        htmlOverflow: html.style.overflow,
      };

      body.style.overflow = "hidden";
      body.style.position = "fixed";
      body.style.top = `-${scrollPosition}px`;
      body.style.left = "0";
      body.style.width = "100%";
      html.style.overflow = "hidden";
    }

    lockDepth += 1;

    return () => {
      lockDepth = Math.max(0, lockDepth - 1);
      if (lockDepth === 0 && savedStyles) {
        body.style.overflow = savedStyles.bodyOverflow;
        body.style.position = savedStyles.bodyPosition;
        body.style.top = savedStyles.bodyTop;
        body.style.left = savedStyles.bodyLeft;
        body.style.width = savedStyles.bodyWidth;
        html.style.overflow = savedStyles.htmlOverflow;
        window.scrollTo(0, scrollPosition);
        savedStyles = null;
      }
    };
  }, [locked, lockHtml]);
}
