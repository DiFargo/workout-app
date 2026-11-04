function perfNow() {
  return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}

const SAFE_META = new Set(["signedIn", "ownPlan", "admin", "workouts", "mode", "role", "route", "outcome"]);

function safeMeta(meta) {
  return Object.fromEntries(Object.entries(meta || {}).filter(([key, value]) =>
    SAFE_META.has(key) && (typeof value === "boolean" || typeof value === "number" ||
      (typeof value === "string" && /^[a-zA-Z0-9_-]{1,40}$/.test(value)))
  ));
}

function savePerformanceRecord(payload) {
  try {
    const key = "workout_app_perf_logs_v1";
    const saved = JSON.parse(localStorage.getItem(key) || "[]");
    const current = Array.isArray(saved) ? saved : [];
    localStorage.setItem(key, JSON.stringify([payload, ...current].slice(0, 50)));
  } catch { /* Diagnostics never block the application. */ }
}

// Local, bounded diagnostics only: no account IDs, URLs, tokens or user content.
export function recordStartupStage(stage, meta = {}) {
  if (typeof window === "undefined") return;
  const stages = ["entry-evaluated", "runtime-loaded", "identity-verified", "profile-verified",
    "role-gate-released", "critical-workouts-ready", "route-content-ready"];
  if (!stages.includes(stage)) return;
  savePerformanceRecord({ label: `Startup · ${stage}`, ms: Math.round(perfNow()),
    at: new Date().toISOString(), ...safeMeta(meta) });
}

export function createPerformanceCheckHandlers(performanceMarksRef) {
  function startPerformanceCheck(label, meta = {}) {
    performanceMarksRef.current[label] = perfNow();
    if (import.meta.env.DEV) console.debug(`⏱️ PERF START · ${label}`, meta);
  }

  function endPerformanceCheck(label, meta = {}) {
    const startedAt = performanceMarksRef.current[label];

    if (!Number.isFinite(startedAt)) return 0;

    const ms = Math.round(perfNow() - startedAt);
    delete performanceMarksRef.current[label];

    const payload = {
      label,
      ms,
      seconds: Math.round((ms / 1000) * 10) / 10,
      at: new Date().toISOString(),
      ...safeMeta(meta)
    };

    if (import.meta.env.DEV) console.debug(`⏱️ PERF · ${label}: ${ms} ms`, payload);

    savePerformanceRecord(payload);

    return ms;
  }

  return {
    startPerformanceCheck,
    endPerformanceCheck
  };
}
