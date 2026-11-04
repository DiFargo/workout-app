const INVALID = { status: 401, body: { ok: false, error: "auth/invalid-credential" } };
const RESET_ACCEPTED = { status: 200, body: { ok: true } };
const UNKNOWN_EMAIL = "unregistered-login@invalid.invalid";
const clean = value => typeof value === "string" ? value.trim().toLowerCase() : "";

function disabledProfile(profile = {}) {
  return profile.active === false || profile.archived === true || profile.accessDisabled === true || profile.disabled === true
    || ["disabled", "archived", "blocked"].includes(profile.accountStatus)
    || ["disabled", "revoked", "suspended", "blocked"].includes(profile.accountAccessStatus)
    || ["revoked", "suspended"].includes(profile.membershipStatus);
}

async function readBoundedJson(response, maximum) {
  const length = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(length) && length > maximum) throw new Error("provider-response-size");
  if (!response.body?.getReader) throw new Error("provider-response-stream-required");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) { await reader.cancel(); throw new Error("provider-response-size"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function providerRequest({ action, payload, fetchImpl, apiKey, timeoutMs, maxResponseBytes }) {
  // Never derive the transport origin or redirect target from request data.
  const endpoint = new URL(`https://identitytoolkit.googleapis.com/v1/accounts:${action}`);
  endpoint.searchParams.set("key", apiKey);
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetchImpl(endpoint.href, {
          method: "POST", redirect: "error", signal: controller.signal,
          headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
        });
        const data = await readBoundedJson(response, maxResponseBytes);
        return { ok: response.ok, data };
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error("provider-timeout")); }, timeoutMs);
      })
    ]);
  } finally { clearTimeout(timer); }
}

// DI boundary for the public App-Check/rate-limited endpoint. No provider
// response, credential, resolved email or refresh token leaves this helper.
export async function authenticateLoginAlias({ body = {}, db, auth, fetchImpl = globalThis.fetch, apiKey, timeoutMs = 8000, maxResponseBytes = 65536 }) {
  const reset = body?.action === "reset-password";
  const rejected = () => reset ? RESET_ACCEPTED : INVALID;
  try {
    const login = clean(body?.login);
    const password = body?.password;
    if (!/^[a-z0-9._-]{3,32}$/.test(login) || (body.action && !reset)
      || (!reset && (typeof password !== "string" || !password || Buffer.byteLength(password, "utf8") > 4096))
      || typeof apiKey !== "string" || !apiKey || apiKey.length > 256 || typeof fetchImpl !== "function") return rejected();
    const snapshot = await db.collection("loginAliases").doc(login).get();
    const alias = snapshot.exists ? snapshot.data() || {} : {};
    const uid = typeof alias.uid === "string" && alias.uid.length <= 128
      && !alias.uid.includes("/") && !alias.uid.includes("\\") && !/\s/.test(alias.uid) ? alias.uid : "";
    const email = clean(alias.email);
    const known = Boolean(uid && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254);
    // Unknown aliases still cross the same fixed provider boundary. The dummy
    // address is reserved/non-deliverable, and all reset outcomes stay neutral.
    const provider = await providerRequest({
      action: reset ? "sendOobCode" : "signInWithPassword",
      payload: reset
        ? { requestType: "PASSWORD_RESET", email: known ? email : UNKNOWN_EMAIL }
        : { email: known ? email : UNKNOWN_EMAIL, password, returnSecureToken: true },
      fetchImpl, apiKey, timeoutMs: Math.min(10000, Math.max(1, Number(timeoutMs) || 8000)),
      maxResponseBytes: Math.min(65536, Math.max(1024, Number(maxResponseBytes) || 65536))
    });
    if (reset) return RESET_ACCEPTED;
    if (!known || !provider.ok || provider.data?.localId !== uid
      || typeof provider.data?.idToken !== "string" || !provider.data.idToken || provider.data.mfaPendingCredential) return INVALID;
    const [authUser, profileSnapshot] = await Promise.all([
      auth.getUser(uid), db.collection("users").doc(uid).get()
    ]);
    if (authUser.disabled || authUser.uid !== uid || clean(authUser.email) !== email
      || (profileSnapshot.exists && disabledProfile(profileSnapshot.data() || {}))) return INVALID;
    // Membership/role admission is intentionally left to the existing bootstrap:
    // invited and awaiting-trainer users must still be able to authenticate.
    const customToken = await auth.createCustomToken(uid);
    if (typeof customToken !== "string" || !customToken || customToken.length > 16384) return INVALID;
    return { status: 200, body: { ok: true, customToken } };
  } catch {
    // Never log upstream errors: their messages/bodies can contain credentials
    // or account identifiers, and differing details create an alias oracle.
    return rejected();
  }
}
