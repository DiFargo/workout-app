const FEATURES = new Set(["main", "workouts", "workoutMode", "workoutPlan", "history", "nutrition", "measurementWizard", "profile", "admin", "adminUsers", "adminWorkouts", "adminLibrary", "adminPanel", "basicWorkoutQuiz", "basicWorkoutToday"]);
const ERROR_NAMES = new Set(["TypeError", "ReferenceError", "RangeError", "SyntaxError", "ChunkLoadError", "QuotaExceededError"]);

export function createRuntimeDiagnostic(error, { feature, version, now = new Date(), id } = {}) {
  const name = ERROR_NAMES.has(error?.name) ? error.name : "Error";
  const raw = String(error?.message || "");
  // Never collect arbitrary Error messages: they may contain user-entered text.
  const property = raw.match(/Cannot read properties of (null|undefined) \(reading ['"]([A-Za-z_$][\w$]{0,60})['"]\)/);
  const missing = raw.match(/^([A-Za-z_$][\w$]{0,60}) is not defined$/);
  const message = property ? `Cannot read properties of ${property[1]} (reading '${property[2]}')`
    : missing ? `${missing[1]} is not defined`
      : /dynamically imported module|Loading chunk|module script/i.test(raw) ? "Module loading failed"
        : name === "QuotaExceededError" ? "Browser storage quota exceeded" : `${name}: runtime failure`;
  const frames = [...String(error?.stack || "").matchAll(/https?:\/\/[^\s)]+/g)].map(match => {
    // Only generated JS asset coordinates, never URLs, queries or source contents.
    const frame = match[0].match(/\/assets\/([A-Za-z0-9_.-]+\.js):(\d+):(\d+)(?:$|[?#])/);
    return frame ? `${frame[1]}:${frame[2]}:${frame[3]}` : "";
  }).filter(Boolean).slice(0, 4);
  return { schemaVersion: 1, id: id || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    occurredAt: now.toISOString(), feature: FEATURES.has(feature) ? feature : "unknown",
    version: /^\d+\.\d+\.\d+$/.test(String(version)) ? version : "unknown", error: { name, message, frames } };
}

export function rememberRuntimeDiagnostic(uid, diagnostic) {
  if (!uid) return false;
  try { sessionStorage.setItem(`ownset_runtime_diagnostic_v1:${uid}`, JSON.stringify(diagnostic)); return true; }
  catch { return false; } // The boundary also keeps an in-memory copy when storage is full.
}

export function runtimeDiagnosticMessage(diagnostic) {
  // Build from an allowlisted shape, not from caller-provided free-form fields.
  return `Технический отчёт о сбое интерфейса\n${JSON.stringify({ id: diagnostic.id, occurredAt: diagnostic.occurredAt,
    feature: diagnostic.feature, version: diagnostic.version, error: diagnostic.error }, null, 2)}`.slice(0, 1200);
}
