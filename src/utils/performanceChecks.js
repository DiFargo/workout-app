function perfNow() {
  return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}

export function createPerformanceCheckHandlers(performanceMarksRef) {
  function startPerformanceCheck(label, meta = {}) {
    performanceMarksRef.current[label] = perfNow();
    if (import.meta.env.DEV) console.debug(`⏱️ PERF START · ${label}`, meta);
  }

  function endPerformanceCheck(label, meta = {}) {
    const startedAt = performanceMarksRef.current[label];

    if (!startedAt) return 0;

    const ms = Math.round(perfNow() - startedAt);
    delete performanceMarksRef.current[label];

    const payload = {
      label,
      ms,
      seconds: Math.round((ms / 1000) * 10) / 10,
      at: new Date().toISOString(),
      ...meta
    };

    if (import.meta.env.DEV) console.debug(`⏱️ PERF · ${label}: ${ms} ms`, payload);

    try {
      const key = "workout_app_perf_logs_v1";
      const current = JSON.parse(localStorage.getItem(key) || "[]");
      localStorage.setItem(key, JSON.stringify([payload, ...current].slice(0, 50)));
    } catch {
      // ignore localStorage errors
    }

    return ms;
  }

  return {
    startPerformanceCheck,
    endPerformanceCheck
  };
}
