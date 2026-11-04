import { useEffect } from "react";
import { TRAINER_INITIAL_SUMMARY_PAGE_SIZE } from "../../features/trainer/trainerSummaryReadScheduler.js";

// The directory itself stays complete. Only detailed sources are virtualised.
export function useVisibleTrainerSummaries(rootRef, summaries, loading, onRequest, listKey) {
  useEffect(() => {
    if (loading || !onRequest || !rootRef.current || typeof IntersectionObserver === "undefined") return;
    const visible = new Set();
    let timer;
    let dispatched = false;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const id = entry.target.dataset.trainerSummaryClient;
        if (entry.isIntersecting) visible.add(id); else visible.delete(id);
      }
      if (!visible.size || dispatched || timer) return;
      timer = setTimeout(() => {
        timer = null;
        if (!visible.size || dispatched) return;
        dispatched = true;
        const ids = [...visible].slice(0, TRAINER_INITIAL_SUMMARY_PAGE_SIZE);
        void Promise.resolve(onRequest(ids)).catch(error => console.warn("Visible client summaries failed:", error));
      }, 40);
    }, { rootMargin: "160px" });
    for (const node of rootRef.current.querySelectorAll("[data-trainer-summary-client]")) {
      if (summaries[node.dataset.trainerSummaryClient]?.trainerSummaryState === "deferred") observer.observe(node);
    }
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, [rootRef, summaries, loading, onRequest, listKey]);
}
