import { useEffect } from "react";

export function usePreventMobileZoom() {
  useEffect(() => {
    const preventGestureZoom = (event) => event.preventDefault();
    const preventMultiTouchZoom = (event) => {
      if (event.touches?.length > 1) event.preventDefault();
    };
    const isTouchDevice = window.matchMedia?.("(hover: none) and (pointer: coarse)")?.matches;
    const lockPortraitOrientation = () => {
      if (!isTouchDevice || !window.screen?.orientation?.lock) return;
      window.screen.orientation.lock("portrait-primary").catch(() => {
        // Mobile browsers allow orientation lock only in some contexts.
        window.screen.orientation.lock("portrait").catch(() => {});
      });
    };

    document.addEventListener("gesturestart", preventGestureZoom, { passive: false });
    document.addEventListener("gesturechange", preventGestureZoom, { passive: false });
    document.addEventListener("gestureend", preventGestureZoom, { passive: false });
    document.addEventListener("touchmove", preventMultiTouchZoom, { passive: false });
    document.addEventListener("visibilitychange", lockPortraitOrientation);
    window.addEventListener("orientationchange", lockPortraitOrientation);
    window.addEventListener("resize", lockPortraitOrientation);
    lockPortraitOrientation();

    return () => {
      document.removeEventListener("gesturestart", preventGestureZoom);
      document.removeEventListener("gesturechange", preventGestureZoom);
      document.removeEventListener("gestureend", preventGestureZoom);
      document.removeEventListener("touchmove", preventMultiTouchZoom);
      document.removeEventListener("visibilitychange", lockPortraitOrientation);
      window.removeEventListener("orientationchange", lockPortraitOrientation);
      window.removeEventListener("resize", lockPortraitOrientation);
    };
  }, []);
}
