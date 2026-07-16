import { useEffect } from "react";

export function useNutritionPageScrollEffect({ active }) {
  useEffect(() => {
    if (!active) return undefined;

    const scrollNutritionToTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.scrollingElement?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      document
        .querySelector('[data-testid="nutrition-page"]')
        ?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
    };

    scrollNutritionToTop();
    const frame = window.requestAnimationFrame(scrollNutritionToTop);
    const timeout = window.setTimeout(scrollNutritionToTop, 80);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [active]);
}
