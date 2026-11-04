import { auth as appAuth } from "../firebase.js";
import { fetchAuthorizedWithTimeout } from "./apiClient.js";
import { captureAuthSession } from "./authSession.js";

export function validateClientLoadingSnapshot(snapshot, kind, uid) {
  const invalid = () => { throw Object.assign(new Error("Сервер не подтвердил полноту данных. Повторите загрузку."), { code: "loading/snapshot-invalid" }); };
  if (snapshot?.schemaVersion !== 1 || snapshot.kind !== kind || snapshot.uid !== uid ||
    !/^[a-f0-9]{64}$/.test(snapshot.sourceRevision || "") || snapshot.coverage?.profile !== "complete") invalid();
  if (kind === "workouts") {
    if (snapshot.coverage.workouts !== "complete" || snapshot.coverage.history !== "complete" || !snapshot.profile ||
      !Array.isArray(snapshot.workouts) || !Array.isArray(snapshot.completionHistory) ||
      snapshot.sourceCounts?.workouts !== snapshot.workouts.length || snapshot.sourceCounts?.history !== snapshot.completionHistory.length ||
      !snapshot.latestExerciseResultsByAssignment || !snapshot.latestExerciseResultDatesByAssignment ||
      snapshot.workouts.some(row => !row || typeof row.id !== "string" || !row.id || !row.data || typeof row.data !== "object") ||
      snapshot.completionHistory.some(row => !row || typeof row !== "object" || Object.hasOwn(row, "exercises"))) invalid();
  } else if (kind === "measurements") {
    if (snapshot.coverage.measurements !== "complete" || !Array.isArray(snapshot.measurements?.recent7) ||
      snapshot.measurements.recent7.length !== Math.min(7, snapshot.sourceCounts?.measurements)) invalid();
  } else invalid();
  return snapshot;
}

export async function readClientLoadingSnapshot({ kind = "workouts", auth = appAuth, request = fetchAuthorizedWithTimeout } = {}) {
  const session = captureAuthSession(auth);
  if (!session.isCurrent()) throw Object.assign(new Error("Войдите в аккаунт."), { code: "loading/auth-required" });
  const response = await request("/api/client-loading-snapshot", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind })
  }, 16000);
  const result = await response.json().catch(() => ({}));
  if (!session.isCurrent()) throw Object.assign(new Error("Сеанс изменился."), { code: "loading/session-changed" });
  if (!response.ok) throw Object.assign(new Error(result.message || result.error || "Не удалось подтвердить данные."),
    { status: response.status, code: result.code || "loading/snapshot-failed" });
  return validateClientLoadingSnapshot(result.snapshot || result, kind, session.uid);
}
