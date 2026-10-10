import { useLayoutEffect, useRef } from "react";
import styles from "./WorkoutRunPageShell.module.css";

export default function WorkoutRunPageShell({ children, noHeader = false }) {
  const rootRef = useRef(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return undefined;

    // Budget the real remaining height, including system bars, wrapped text and
    // the dock. Media and warmup spacing yield space; touch targets stay usable.
    let observed = new Set();
    const setSize = (name, value) => {
      const next = `${value}px`;
      if (root.style.getPropertyValue(name) !== next) root.style.setProperty(name, next);
    };
    const measure = () => {
      const dock = root.querySelector('[data-css-module-scope="workout-stage-action-panel"], [data-testid="workout-finish-actions"]');
      setSize("--workout-dock-height", Math.ceil(dock?.getBoundingClientRect().height || 0));
      const deck = root.querySelector('[data-workout-stage="exercise"], [data-workout-stage="warmup"]');
      if (deck) {
        const padding = getComputedStyle(deck);
        const available = Math.max(0, deck.clientHeight - parseFloat(padding.paddingTop) - parseFloat(padding.paddingBottom));
        setSize("--workout-stage-usable-height", Math.floor(available));
      } else {
        root.style.removeProperty("--workout-stage-usable-height");
      }
      const card = deck?.querySelector('[data-workout-stage-card="exercise"]');
      const media = card?.querySelector('[data-workout-media-area]');
      if (!media) {
        root.style.removeProperty("--workout-media-max-height");
        return;
      }
      const available = parseFloat(root.style.getPropertyValue("--workout-stage-usable-height"));
      const otherContent = card.getBoundingClientRect().height - media.getBoundingClientRect().height;
      // Many sets, landscape and enlarged text fall back to the existing
      // scroller rather than making the demonstration or buttons unusably small.
      setSize("--workout-media-max-height", Math.max(100, Math.floor(available - otherContent - 2)));
    };
    let resizeFrame = 0;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeFrame) return;
      // CSS density can resize the observed plan itself. Defer the next
      // measurement outside the observer delivery cycle (notably in WebKit).
      resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; measure(); });
    });
    const observeLayout = () => {
      const next = new Set([root, ...root.querySelectorAll(
        '[data-testid="workout-run-stage"], [data-testid="workout-plan-section"], [data-testid="basic-workout-exercise-explainer"] nav, [data-css-module-scope="workout-stage-action-panel"], [data-testid="workout-finish-actions"]'
      )]);
      for (const element of observed) if (!next.has(element)) resizeObserver.unobserve(element);
      for (const element of next) if (!observed.has(element)) resizeObserver.observe(element);
      observed = next;
      measure();
    };
    const mutationObserver = new MutationObserver(observeLayout);
    mutationObserver.observe(root, { childList: true, subtree: true });
    observeLayout();
    return () => {
      cancelAnimationFrame(resizeFrame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${noHeader ? styles.noHeader : ""}`}
      data-css-module-scope="workout-run-page"
      data-workout-run-no-header={noHeader ? "true" : "false"}
    >
      {children}
    </div>
  );
}
