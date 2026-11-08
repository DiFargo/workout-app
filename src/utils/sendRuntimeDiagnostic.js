import { runtimeDiagnosticMessage } from "./runtimeDiagnostics.js";

export async function sendRuntimeDiagnostic(diagnostic, ownerUid) {
  const [{ auth, db }, { doc, setDoc }] = await Promise.all([import("../firebase.js"), import("firebase/firestore")]);
  if (!ownerUid || auth.currentUser?.uid !== ownerUid) throw new Error("Войдите в тот же аккаунт, чтобы отправить отчёт.");
  const { captureAuthSession } = await import("./authSession.js");
  const session = captureAuthSession(auth);
  const path = doc(db, "users", ownerUid, "feedback", `runtime_${diagnostic.id.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 100)}`);
  if (!session.isCurrent()) throw new Error("Сессия изменилась. Повторите вход.");
  // Stable ID makes retries idempotent. Do not recreate a processed report.
  // Firestore create-only feedback rules reject a duplicate; confirm it by reading.
  const payload = { type: "bug", message: runtimeDiagnosticMessage(diagnostic), recipient: "admin", status: "new",
    appVersion: diagnostic.version, createdAt: diagnostic.occurredAt, source: "runtime-error-report", userId: ownerUid,
    attachments: [], attachment: null, contact: "", displayName: "Отчёт о сбое", email: "" };
  const { getDoc } = await import("firebase/firestore");
  let timer;
  try {
    await Promise.race([
      (async () => {
        if ((await getDoc(path)).exists()) return;
        if (!session.isCurrent()) throw new Error("Сессия изменилась. Повторите вход.");
        await setDoc(path, payload);
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("diagnostic-send-timeout")), 15000); })
    ]);
    if (!session.isCurrent()) throw new Error("Сессия изменилась. Повторите вход.");
  } finally { clearTimeout(timer); }
}
