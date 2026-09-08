import { useEffect } from "react";
import { acquireBodyScrollLock } from "./useBodyScrollLock";
import { guardModalScroll } from "./modalScrollGuard";

export function useModalFocusTrap() {
  useEffect(() => {
    let activeDialog = null;
    let previousFocus = null;
    let restoreBackground = [];
    let removeKeyHandler = null;
    let releaseBodyLock = null;
    let releaseScrollGuard = null;
    let mutedBackdrops = [];

    const deactivateDialog = () => {
      releaseScrollGuard?.();
      releaseScrollGuard = null;
      mutedBackdrops.forEach(element => element.removeAttribute("data-modal-backdrop-muted"));
      mutedBackdrops = [];
      removeKeyHandler?.();
      removeKeyHandler = null;
      restoreBackground.forEach(({ element, inert, ariaHidden }) => {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      });
      restoreBackground = [];

      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }

      previousFocus = null;
      activeDialog = null;
    };

    const activateDialog = () => {
      const dialogs = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')]
        .filter((dialog) => (
          dialog instanceof HTMLElement &&
          !dialog.hidden &&
          dialog.getClientRects().length > 0
        ));
      const dialog = dialogs.at(-1) || null;

      if (dialog === activeDialog) return;
      deactivateDialog();
      if (!dialog) {
        releaseBodyLock?.();
        releaseBodyLock = null;
        return;
      }

      releaseBodyLock ||= acquireBodyScrollLock();
      releaseScrollGuard = guardModalScroll(dialog);

      const backdropSelector = '[data-modal-backdrop="true"], [data-trainer-modal-backdrop="true"]';
      const activeBackdrop = dialog.closest(backdropSelector) ||
        [...(dialog.parentElement?.children || [])].find(element => element.matches(backdropSelector));
      if (activeBackdrop) {
        mutedBackdrops = [...document.querySelectorAll(backdropSelector)].filter(element => element !== activeBackdrop);
        mutedBackdrops.forEach(element => element.setAttribute("data-modal-backdrop-muted", "true"));
      }

      activeDialog = dialog;
      previousFocus = document.activeElement;

      let current = dialog;
      while (current.parentElement && current.parentElement.id !== "root") {
        const parent = current.parentElement;
        [...parent.children].forEach((sibling) => {
          if (sibling === current || !(sibling instanceof HTMLElement) || sibling.matches('[data-modal-backdrop="true"], [data-trainer-modal-backdrop="true"]')) return;
          restoreBackground.push({
            element: sibling,
            inert: sibling.inert,
            ariaHidden: sibling.getAttribute("aria-hidden")
          });
          sibling.inert = true;
          sibling.setAttribute("aria-hidden", "true");
        });
        current = parent;
      }

      if (!dialog.hasAttribute("tabindex")) dialog.setAttribute("tabindex", "-1");
      const getFocusable = () => [...dialog.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )].filter((element) => element instanceof HTMLElement && element.offsetParent !== null);
      const closeButton = dialog.querySelector(
        '[aria-label*="Закрыть"]:not([aria-label*="фону"]), [aria-label*="закрыть"]:not([aria-label*="фону"]), .modalCloseButton, .profileModalClose'
      );

      window.requestAnimationFrame(() => {
        if (activeDialog !== dialog || !dialog.isConnected) return;
        const focusTarget = closeButton instanceof HTMLElement ? closeButton : getFocusable()[0] || dialog;
        focusTarget.focus({ preventScroll: true });
      });

      const onKeyDown = (event) => {
        if (event.key !== "Tab") return;
        const focusable = getFocusable();
        if (!focusable.length) {
          event.preventDefault();
          dialog.focus({ preventScroll: true });
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      };

      document.addEventListener("keydown", onKeyDown);
      removeKeyHandler = () => document.removeEventListener("keydown", onKeyDown);
    };

    const observer = new MutationObserver(activateDialog);
    observer.observe(document.body, { childList: true, subtree: true });
    activateDialog();

    return () => {
      observer.disconnect();
      deactivateDialog();
      releaseBodyLock?.();
    };
  }, []);
}
