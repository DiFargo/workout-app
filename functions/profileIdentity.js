// Auth and Firestore cannot share a transaction. A server-owned operation keeps
// an email change retryable if Auth succeeds but the final Firestore write fails.
const clean = (value) => String(value || "").trim().toLowerCase();
const defaultAlias = (email) => /^[a-z0-9._-]{3,32}$/.test(clean(email).split("@")[0]) ? clean(email).split("@")[0] : "";
function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export function requireRecentIdentityAuth(token = {}, now = Date.now()) {
  const authenticatedAt = Number(token.auth_time) * 1000;
  if (!Number.isFinite(authenticatedAt) || authenticatedAt <= 0 || now - authenticatedAt > 5 * 60 * 1000 || authenticatedAt > now + 30000) {
    fail(401, "auth/requires-recent-login");
  }
}

async function readIdentity(transaction, db, uid, fallbackEmail) {
  const ref = db.collection("users").doc(uid);
  const snapshot = await transaction.get(ref);
  if (!snapshot.exists) fail(404, "profile-not-found");
  const data = snapshot.data();
  const alias = clean(data.loginLower || data.accountProfile?.login || defaultAlias(fallbackEmail));
  const aliasRef = alias ? db.collection("loginAliases").doc(alias) : null;
  const aliasSnapshot = aliasRef ? await transaction.get(aliasRef) : null;
  if (aliasSnapshot?.exists && aliasSnapshot.data().uid !== uid) fail(409, "login-ownership-conflict");
  return { ref, data, alias, aliasRef, aliasSnapshot };
}

export async function updateProfileLogin({ db, auth, uid, login, now = () => new Date().toISOString() }) {
  const nextAlias = clean(login);
  if (!/^[a-z0-9._-]{3,32}$/.test(nextAlias)) fail(400, "invalid-login");
  const authUser = await auth.getUser(uid);
  const email = clean(authUser.email);
  if (!email) fail(400, "missing-email");
  return db.runTransaction(async (transaction) => {
    const current = await readIdentity(transaction, db, uid, email);
    if (current.data.profileIdentityOperation) fail(409, "email-update-pending");
    const nextRef = db.collection("loginAliases").doc(nextAlias);
    const nextSnapshot = await transaction.get(nextRef);
    if (nextSnapshot.exists && nextSnapshot.data().uid !== uid) fail(409, "login-already-in-use");
    const updatedAt = now();
    const accountProfile = { ...current.data.accountProfile, email, login: nextAlias, updatedAt };
    transaction.set(current.ref, { loginLower: nextAlias, accountProfile, updatedAt }, { merge: true });
    transaction.set(nextRef, { uid, email, updatedAt, ...(nextSnapshot.exists ? {} : { createdAt: updatedAt }) }, { merge: true });
    if (current.aliasSnapshot?.exists && current.alias !== nextAlias) transaction.delete(current.aliasRef);
    return { ok: true, login: nextAlias, accountProfile };
  });
}

export async function updateProfileEmail({ db, auth, uid, email, operationId, now = () => new Date().toISOString() }) {
  const nextEmail = clean(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) fail(400, "invalid-email");
  const authUser = await auth.getUser(uid);
  const currentEmail = clean(authUser.email);
  const existing = await auth.getUserByEmail(nextEmail).catch((error) => {
    if (error.code === "auth/user-not-found") return null;
    throw error;
  });
  if (existing && existing.uid !== uid) fail(409, "email-already-in-use");
  const operation = await db.runTransaction(async (transaction) => {
    const current = await readIdentity(transaction, db, uid, currentEmail);
    const pending = current.data.profileIdentityOperation;
    if (pending) {
      if (pending.email !== nextEmail) fail(409, "email-update-pending");
      return pending;
    }
    const pendingOperation = { id: operationId, email: nextEmail, previousEmail: currentEmail, alias: current.alias, startedAt: now() };
    // Reserve a previously missing alias before changing Auth. Existing aliases
    // keep their old email until finalization; another account cannot claim it.
    if (current.aliasRef && !current.aliasSnapshot.exists) transaction.set(current.aliasRef, { uid, email: currentEmail, updatedAt: now() });
    transaction.set(current.ref, { profileIdentityOperation: pendingOperation }, { merge: true });
    return pendingOperation;
  });
  try {
    if (currentEmail !== nextEmail) await auth.updateUser(uid, { email: nextEmail, emailVerified: false });
  } catch (error) {
    // A timeout may have happened after Auth committed. Only release the lock
    // when a fresh read proves the original identity is still in place.
    const freshAuth = await auth.getUser(uid).catch(() => null);
    if (clean(freshAuth?.email) === operation.previousEmail) {
      await db.runTransaction(async (transaction) => {
        const ref = db.collection("users").doc(uid);
        const snapshot = await transaction.get(ref);
        if (snapshot.data()?.profileIdentityOperation?.id === operation.id) transaction.set(ref, { profileIdentityOperation: null }, { merge: true });
      });
    }
    throw error;
  }
  return db.runTransaction(async (transaction) => {
    const current = await readIdentity(transaction, db, uid, currentEmail);
    const pending = current.data.profileIdentityOperation;
    if (pending?.id !== operation.id && clean(current.data.email) !== nextEmail) fail(409, "identity-operation-conflict");
    const updatedAt = now();
    const accountProfile = {
      ...current.data.accountProfile,
      displayName: current.data.accountProfile?.displayName || current.data.name || authUser.displayName || "",
      avatarUrl: current.data.accountProfile?.avatarUrl || current.data.avatarUrl || authUser.photoURL || "",
      email: nextEmail, login: operation.alias, updatedAt
    };
    transaction.set(current.ref, { email: nextEmail, loginLower: operation.alias, accountProfile, profileIdentityOperation: null, pendingEmail: "", pendingEmailRequestedAt: "", updatedAt }, { merge: true });
    if (current.aliasRef) transaction.set(current.aliasRef, { uid, email: nextEmail, updatedAt }, { merge: true });
    return { ok: true, email: nextEmail, loginAlias: operation.alias, accountProfile };
  });
}
