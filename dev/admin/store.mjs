const clone = value => structuredClone(value);
const failure = (error, status = 400) => ({ status, body: { ok: false, error } });

export const PREVIEW_USER = Object.freeze({ uid: "local-admin", id: "local-admin", displayName: "Администратор", name: "Администратор", email: "admin@example.test", role: "admin" });
const INITIAL_USERS = [
  { id: "local-client-1", name: "Анна Ковалёва", email: "anna@example.test", role: "client", accountStatus: "active", firstSetupCompleted: true, trainerId: "local-trainer-1" },
  { id: "local-client-2", name: "Дмитрий Орлов", email: "dmitry@example.test", role: "client", accountStatus: "active", firstSetupCompleted: true },
  { id: "local-trainer-1", name: "Алексей Соколов", email: "alex@example.test", role: "trainer", accountStatus: "active" },
  { id: "local-trainer-2", name: "Мария Новикова", email: "maria@example.test", role: "trainer", accountStatus: "pending" },
  PREVIEW_USER
];

function allowedPath(path, document = false) {
  const parts = String(path || "").split("/");
  const collection = parts[0] === "basicExerciseOverrides" ? 1
    : parts.slice(0, 3).join("/") === "admin/basicProgramTemplates/items" ? 3 : 0;
  return Boolean(collection && parts.every(part => part !== "." && part !== ".." && /^[\w.-]+$/.test(part)) && (
    parts.length === collection + Number(document)
    || collection === 3 && parts[4] === "versions" && parts.length === 5 + Number(document)
  ));
}

// In-memory state belongs to this DEV server, never Firebase or localStorage.
export function createPreviewStore() {
  const records = new Map();
  const users = clone(INITIAL_USERS);
  return {
    request(path, payload = {}) {
      if (path === "/__preview/users") return { status: 200, body: { users: clone(users), user: PREVIEW_USER } };
      if (path === "/__preview/firestore/read") {
        if (!allowedPath(payload.path)) return failure("local_collection_not_supported", 403);
        const prefix = `${payload.path}/`;
        return { status: 200, body: { docs: [...records].filter(([key]) => key.startsWith(prefix) && !key.slice(prefix.length).includes("/"))
          .map(([key, data]) => ({ id: key.slice(prefix.length), data: clone(data) })) } };
      }
      if (path === "/__preview/firestore/write") {
        if (!Array.isArray(payload.writes) || !payload.writes.length || payload.writes.length > 50
          || payload.writes.some(write => !allowedPath(write.path, true) || !write.data || typeof write.data !== "object" || Array.isArray(write.data))) {
          return failure("local_write_not_supported", 403);
        }
        for (const write of payload.writes) records.set(write.path, clone(write.merge ? { ...records.get(write.path), ...write.data } : write.data));
        return { status: 200, body: { ok: true } };
      }
      if (path === "/api/admin/assign-client") {
        const client = users.find(user => user.id === payload.clientId && user.role === "client");
        const trainer = users.find(user => user.id === payload.trainerId && user.role === "trainer");
        if (!client || payload.trainerId && !trainer) return failure("local_user_not_found", 404);
        client.trainerId = trainer?.id || "";
        client.trainerEmail = trainer?.email || "";
        return { status: 200, body: { ok: true, client: clone(client) } };
      }
      if (path === "/api/admin/update-user-role") {
        const user = users.find(item => item.id === payload.uid && item.role !== "admin");
        if (!user || !["client", "trainer"].includes(payload.role)) return failure("local_user_not_found", 404);
        user.role = payload.role;
        return { status: 200, body: { ok: true, user: clone(user) } };
      }
      if (path === "/api/admin/create-trainer-invite") {
        if (!String(payload.name || "").trim() || !/^[a-z0-9._-]{3,32}$/.test(payload.login || "")) return failure("invalid_local_invite");
        if (users.some(user => user.login === payload.login)) return failure("login_already_exists", 409);
        const trainer = { id: `local-trainer-${crypto.randomUUID()}`, name: payload.name, login: payload.login, role: "trainer", accountStatus: "pending" };
        users.push(trainer);
        // No real activation URL or bot message is ever created.
        return { status: 200, body: { ok: true, trainer, login: trainer.login } };
      }
      if (path === "/api/admin/feedback" && payload.action === "list") return { status: 200, body: { ok: true, items: [], nextCursor: "" } };
      return failure("Операция недоступна в локальном просмотре. Для интеграций нужно отдельное staging-окружение.", 403);
    }
  };
}

export function previewMiddleware(store) {
  return async (req, res, next) => {
    const path = String(req.url || "").split("?")[0];
    if (!path.startsWith("/__preview/") && !path.startsWith("/api/")) return next();
    const host = req.headers.host || "";
    if (req.headers.origin && req.headers.origin !== `http://${host}`) {
      res.writeHead(403).end(); return;
    }
    if (req.method !== "POST") { res.writeHead(405).end(); return; }
    try {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 2 * 1024 * 1024) { res.writeHead(413).end(); return; }
      }
      const result = store.request(path, JSON.parse(body || "{}"));
      res.writeHead(result.status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      res.end(JSON.stringify(result.body));
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: false, error: "invalid_local_request" }));
    }
  };
}
