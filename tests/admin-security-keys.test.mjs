import assert from "node:assert/strict";
import test from "node:test";
import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { isoCBOR } from "../functions/node_modules/@simplewebauthn/server/esm/helpers/iso/index.js";
import * as realWebAuthn from "../functions/node_modules/@simplewebauthn/server/esm/index.js";
import { createAdminSecurityKeysHandler } from "../functions/adminSecurityKeys.js";

const ORIGIN = "https://tren-85720.web.app";
const RP_ID = "tren-85720.web.app";
const START = Date.parse("2026-10-31T12:00:00Z");
const hash = value => createHash("sha256").update(value).digest("hex");
const encode = value => Buffer.from(value).toString("base64url");

function memoryFirestore(initial) {
  const documents = new Map(Object.entries(structuredClone(initial)));
  const writes = [];
  let tail = Promise.resolve();
  function snapshot(path) {
    return { id: path.split("/").at(-1), ref: reference(path), exists: documents.has(path),
      data: () => structuredClone(documents.get(path)) };
  }
  function collection(path, limit = Infinity) {
    return { path, isQuery: true, limit: value => collection(path, value), doc: id => reference(`${path}/${id}`),
      get: async () => query(path, limit), bound: limit };
  }
  function query(path, limit) {
    return { docs: [...documents.keys()].filter(key => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes("/"))
      .slice(0, limit).map(snapshot) };
  }
  function reference(path) {
    return { path, id: path.split("/").at(-1), collection: name => collection(`${path}/${name}`),
      get: async () => snapshot(path), create: async data => {
        if (documents.has(path)) throw new Error("duplicate");
        documents.set(path, structuredClone(data)); writes.push(["create", path, structuredClone(data)]);
      } };
  }
  const db = { collection,
    async runTransaction(callback) {
      const previous = tail;
      let release;
      tail = new Promise(resolve => { release = resolve; });
      await previous;
      const pending = [];
      const tx = {
        get: async target => target.isQuery ? query(target.path, target.bound) : snapshot(target.path),
        update: (ref, data) => pending.push(["update", ref.path, data]),
        create: (ref, data) => pending.push(["create", ref.path, data]),
        set: (ref, data, options) => pending.push([options?.merge ? "merge" : "set", ref.path, data])
      };
      try {
        const result = await callback(tx);
        for (const [operation, path] of pending) {
          if (operation === "create" && documents.has(path)) throw new Error("duplicate");
          if (operation === "update" && !documents.has(path)) throw new Error("missing");
        }
        for (const [operation, path, data] of pending) {
          documents.set(path, structuredClone(["merge", "update"].includes(operation) ? { ...documents.get(path), ...data } : data));
          writes.push([operation, path, structuredClone(data)]);
        }
        return result;
      } finally { release(); }
    }
  };
  return { db, documents, writes };
}

function keyFixture() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" });
  const publicCose = Buffer.from(isoCBOR.encode(new Map([[1, 2], [3, -7], [-1, 1],
    [-2, new Uint8Array(Buffer.from(jwk.x, "base64url"))], [-3, new Uint8Array(Buffer.from(jwk.y, "base64url"))]])));
  const rawId = randomBytes(32);
  const id = encode(rawId);
  function clientData(type, challenge, options) {
    return Buffer.from(JSON.stringify({ type, challenge, origin: ORIGIN, crossOrigin: false, ...options }));
  }
  function authenticatorData(flags, counter = 0, rpID = RP_ID) {
    const header = Buffer.alloc(37);
    createHash("sha256").update(rpID).digest().copy(header);
    header[32] = flags; header.writeUInt32BE(counter, 33);
    return header;
  }
  return { id, publicCose,
    registration(challenge, { flags = 0x45, counter = 0, rpID = RP_ID, client = {}, attachment = "cross-platform" } = {}) {
      const data = clientData("webauthn.create", challenge, client);
      const length = Buffer.alloc(2); length.writeUInt16BE(rawId.length);
      const authData = Buffer.concat([authenticatorData(flags, counter, rpID), Buffer.alloc(16), length, rawId, publicCose]);
      const attestation = isoCBOR.encode(new Map([["fmt", "none"], ["authData", new Uint8Array(authData)], ["attStmt", new Map()]]));
      return { id, rawId: id, type: "public-key", authenticatorAttachment: attachment,
        response: { clientDataJSON: encode(data), attestationObject: encode(attestation), transports: ["usb"] }, clientExtensionResults: {} };
    },
    authentication(challenge, { flags = 0x05, counter = 1, rpID = RP_ID, client = {}, corruptSignature = false } = {}) {
      const data = clientData("webauthn.get", challenge, client);
      const authData = authenticatorData(flags, counter, rpID);
      const signature = sign("sha256", Buffer.concat([authData, createHash("sha256").update(data).digest()]), privateKey);
      if (corruptSignature) signature[signature.length - 1] ^= 1;
      return { id, rawId: id, type: "public-key", authenticatorAttachment: "cross-platform", response: {
        clientDataJSON: encode(data), authenticatorData: encode(authData), signature: encode(signature), userHandle: null
      }, clientExtensionResults: {} };
    }
  };
}

function fixture({ required = false, authAge = 0, webauthn = realWebAuthn } = {}) {
  let time = START;
  const profile = { role: "admin", active: true, adminClaimVersion: "admin-v1", email: "admin@example.invalid",
    ...(required ? { adminSecurityKeyRequired: true, adminSecurityKeyVersion: "keys-v1" } : {}) };
  const storage = memoryFirestore({ "users/admin": profile,
    "users/other": { ...profile } });
  const token = { uid: "admin", admin: true, adminClaimVersion: "admin-v1", auth_time: Math.floor((START - authAge) / 1000) };
  const state = { ...storage, time: value => { time = value; }, token, uid: "admin", rates: [], appChecks: 0, mints: [],
    authUsers: { admin: { uid: "admin", disabled: false, customClaims: { admin: true, adminClaimVersion: "admin-v1" } },
      other: { uid: "other", disabled: false, customClaims: { admin: true, adminClaimVersion: "admin-v1" } } } };
  const auth = {
    async getUser(uid) { if (state.onGetUser) await state.onGetUser(); return structuredClone(state.authUsers[uid]); },
    async createCustomToken(uid, claims) { state.mints.push({ uid, claims }); return `synthetic-custom-token-${state.mints.length}`; },
    async setCustomUserClaims() { assert.fail("Session proof must never be persisted as global custom claims"); }
  };
  state.deps = { admin: { firestore: () => storage.db, auth: () => auth }, now: () => time, webauthn,
    async verifyAppCheckRequest() { state.appChecks++; if (state.appCheckError) throw state.appCheckError; },
    async getAdminIdentityContext() {
      if (state.identityError) throw state.identityError;
      return { uid: state.uid, token: { ...state.token, uid: state.uid }, userData: structuredClone(storage.documents.get(`users/${state.uid}`)) };
    },
    async enforceRateLimit(uid, action, options) { state.rates.push({ uid, action, options }); if (state.rateError) throw state.rateError; }
  };
  state.handler = createAdminSecurityKeysHandler(state.deps);
  state.request = async (body, override = {}) => {
    const result = { status: 0, body: null, headers: {} };
    const response = { set(name, value) { result.headers[name] = value; return this; },
      status(value) { result.status = value; return this; }, json(value) { result.body = value; return this; } };
    await state.handler({ method: "POST", headers: { "content-type": "application/json", origin: ORIGIN }, body, ...override }, response);
    return result;
  };
  state.options = async purpose => {
    const result = await state.request({ action: `${purpose}-options` });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body;
  };
  state.register = async (key = keyFixture(), options = {}) => {
    const ceremony = await state.options("registration");
    const result = await state.request({ action: "registration-verify", challengeId: ceremony.challengeId,
      response: key.registration(ceremony.options.challenge, options), label: "Мой USB-ключ" });
    return { result, key, ceremony };
  };
  state.enroll = async () => {
    const enrolled = await state.register(); assert.equal(enrolled.result.status, 200, JSON.stringify(enrolled.result.body));
    Object.assign(state.token, state.mints.at(-1).claims);
    return enrolled.key;
  };
  return state;
}

test("first enrollment uses strict RP/UV options, atomically enables policy, and mints session-only proof", async () => {
  const f = fixture();
  const before = await f.request({ action: "status" });
  assert.deepEqual(before.body, { required: false, keys: [], verifiedUntil: null });
  const { result, key, ceremony } = await f.register();
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(ceremony.options.rp.id, RP_ID);
  assert.deepEqual(ceremony.options.hints, ["security-key"]);
  assert.equal(ceremony.options.authenticatorSelection.authenticatorAttachment, "cross-platform");
  assert.equal(ceremony.options.authenticatorSelection.residentKey, "discouraged");
  assert.equal(ceremony.options.authenticatorSelection.userVerification, "required");
  assert.equal(f.documents.get("users/admin").adminSecurityKeyRequired, true);
  const stored = f.documents.get(`adminSecurityKeys/admin/credentials/${hash(key.id)}`);
  assert.equal(stored.credentialId, key.id); assert.equal(stored.publicKey, encode(key.publicCose));
  assert.equal(f.mints.length, 1);
  assert.deepEqual(Object.keys(f.mints[0].claims).sort(), ["adminSecurityKeyRoleVersion", "adminSecurityKeyUntil", "adminSecurityKeyVersion"]);
  assert.equal(f.mints[0].claims.adminSecurityKeyRoleVersion, "admin-v1");
  assert.equal(f.mints[0].claims.adminSecurityKeyUntil, START + 8 * 60 * 60 * 1000);
  assert.equal(f.mints[0].claims.adminSecurityKeyVersion, f.documents.get("users/admin").adminSecurityKeyVersion);
  assert.equal(f.authUsers.admin.customClaims.adminSecurityKeyUntil, undefined);
  Object.assign(f.token, f.mints[0].claims);
  const status = await f.request({ action: "status" });
  assert.deepEqual(status.body, { required: true, keys: [{ id: hash(key.id), label: "Мой USB-ключ", createdAt: START }], verifiedUntil: result.body.verifiedUntil });
  assert.equal(JSON.stringify(status.body).includes(key.id), false);
  assert.equal(JSON.stringify(status.body).includes(stored.publicKey), false);
  assert.ok(f.rates.some(rate => rate.action === "admin-security-key-status"));
  assert.ok(f.rates.some(rate => rate.action === "admin-security-key-challenge"));
  assert.ok(f.rates.some(rate => rate.action === "admin-security-key-verify"));
  assert.equal(status.headers["Cache-Control"], "no-store");
});

test("bootstrap requires recent login; required policy rejects missing/stale/future/wrong-version proof", async () => {
  const old = fixture({ authAge: 301000 });
  assert.equal((await old.request({ action: "registration-options" })).body.error, "recent-authentication-required");
  assert.equal(old.writes.length, 0);
  const f = fixture({ required: true });
  for (const proof of [{}, { adminSecurityKeyVersion: "other", adminSecurityKeyUntil: START + 1000 },
    { adminSecurityKeyVersion: "keys-v1", adminSecurityKeyUntil: START },
    { adminSecurityKeyVersion: "keys-v1", adminSecurityKeyUntil: START + 8 * 3600000 + 1 },
    { adminSecurityKeyVersion: "keys-v1", adminSecurityKeyUntil: START + 0.5 }]) {
    Object.assign(f.token, { adminSecurityKeyVersion: undefined, adminSecurityKeyUntil: undefined, adminSecurityKeyRoleVersion: "admin-v1" }, proof);
    const result = await f.request({ action: "registration-options" });
    assert.equal(result.status, 403); assert.equal(result.body.error, "admin-security-key-required");
  }
  Object.assign(f.token, { adminSecurityKeyVersion: "keys-v1", adminSecurityKeyUntil: START + 1000, adminSecurityKeyRoleVersion: "admin-v1" });
  assert.equal((await f.request({ action: "registration-options" })).status, 200);
});

test("real registration verifier rejects wrong origin/RP/challenge, missing UV, platform and synced/backed-up keys", async () => {
  for (const options of [{ client: { origin: "https://evil.invalid" } }, { rpID: "evil.invalid" },
    { client: { challenge: "wrong-challenge" } }, { flags: 0x41 }, { flags: 0x4d }, { flags: 0x5d },
    { attachment: "platform" }, { client: { crossOrigin: true } }]) {
    const f = fixture();
    const { result } = await f.register(keyFixture(), options);
    assert.equal(result.status, 400, JSON.stringify(options));
    assert.equal(f.mints.length, 0); assert.equal(f.documents.get("users/admin").adminSecurityKeyRequired, undefined);
    assert.equal([...f.documents.keys()].some(path => path.startsWith("adminSecurityKeys/")), false);
    assert.equal(JSON.stringify(result.body).includes("evil.invalid"), false);
  }
});

test("challenges bind user/auth_time/claim version/purpose, expire and are consumed only once", async () => {
  const f = fixture();
  const key = keyFixture();
  const challenge = await f.options("registration");
  const body = { action: "registration-verify", challengeId: challenge.challengeId, response: key.registration(challenge.options.challenge) };
  f.uid = "other";
  assert.equal((await f.request(body)).body.error, "security-key-challenge-invalid");
  assert.equal(f.documents.get(`adminSecurityKeyChallenges/${challenge.challengeId}`).usedAt, null);
  f.uid = "admin"; f.token.auth_time--;
  assert.equal((await f.request(body)).body.error, "security-key-challenge-invalid");
  f.token.auth_time++;
  const wrongPurpose = await f.request({ ...body, action: "authentication-verify", response: key.authentication(challenge.options.challenge) });
  assert.equal(wrongPurpose.body.error, "security-key-challenge-invalid");
  f.documents.get(`adminSecurityKeyChallenges/${challenge.challengeId}`).adminClaimVersion = "revoked-version";
  assert.equal((await f.request(body)).body.error, "security-key-challenge-invalid");
  f.documents.get(`adminSecurityKeyChallenges/${challenge.challengeId}`).adminClaimVersion = "admin-v1";
  f.time(START + 300000);
  assert.equal((await f.request(body)).body.error, "security-key-challenge-invalid");
  const g = fixture();
  const registration = await g.register();
  assert.equal(registration.result.status, 200);
  const replay = await g.request({ action: "registration-verify", challengeId: registration.ceremony.challengeId,
    response: registration.key.registration(registration.ceremony.options.challenge) });
  assert.equal(replay.status, 409); assert.equal(g.mints.length, 1);
});

test("real assertion signature verifies; enrolled key only, counter monotonic, UV/origin/RP and one-use enforced", async () => {
  const f = fixture(); const key = await f.enroll();
  const start = await f.options("authentication");
  assert.deepEqual(start.options.allowCredentials.map(item => item.id), [key.id]);
  assert.equal(start.options.userVerification, "required");
  assert.deepEqual(start.options.hints, ["security-key"]);
  const body = { action: "authentication-verify", challengeId: start.challengeId, response: key.authentication(start.options.challenge) };
  assert.equal((await f.request(body)).status, 200);
  assert.equal(f.documents.get(`adminSecurityKeys/admin/credentials/${hash(key.id)}`).counter, 1);
  assert.equal((await f.request(body)).status, 409);
  for (const options of [{ counter: 1 }, { counter: 0 }, { counter: 2, corruptSignature: true },
    { counter: 2, flags: 0x01 }, { counter: 2, flags: 0x0d }, { counter: 2, flags: 0x1d },
    { counter: 2, client: { origin: "https://evil.invalid" } }, { counter: 2, rpID: "evil.invalid" },
    { counter: 2, client: { challenge: "wrong-challenge" } }]) {
    const ceremony = await f.options("authentication");
    const result = await f.request({ action: "authentication-verify", challengeId: ceremony.challengeId,
      response: key.authentication(ceremony.options.challenge, options) });
    assert.equal(result.status, 400, JSON.stringify(options));
  }
  const unknown = keyFixture(); const ceremony = await f.options("authentication");
  assert.equal((await f.request({ action: "authentication-verify", challengeId: ceremony.challengeId,
    response: unknown.authentication(ceremony.options.challenge) })).body.error, "security-key-not-enrolled");
  assert.equal(f.mints.length, 2);
});

test("backup registration requires current proof, retains policy version and enforces five-key cap", async () => {
  const f = fixture(); await f.enroll();
  const version = f.documents.get("users/admin").adminSecurityKeyVersion;
  for (let i = 1; i < 5; i++) assert.equal((await f.register()).result.status, 200);
  assert.equal(f.documents.get("users/admin").adminSecurityKeyVersion, version);
  assert.equal((await f.request({ action: "registration-options" })).body.error, "security-key-limit");
  const status = await f.request({ action: "status" }); assert.equal(status.body.keys.length, 5);
  delete f.token.adminSecurityKeyUntil;
  assert.equal((await f.request({ action: "registration-options" })).status, 403);
});

test("mutation rechecks role/version/activity/policy after cryptographic verification and checks Admin SDK claims before mint", async () => {
  for (const mutate of [data => { data.role = "client"; }, data => { data.adminClaimVersion = "v2"; },
    data => { data.active = false; }, data => { data.archived = true; }, data => { data.accessDisabled = true; },
    data => { data.membershipStatus = "revoked"; }, data => { data.adminSecurityKeyVersion = "changed"; }]) {
    let f;
    const webauthn = { ...realWebAuthn, async verifyRegistrationResponse(options) {
      const result = await realWebAuthn.verifyRegistrationResponse(options); mutate(f.documents.get("users/admin")); return result;
    } };
    f = fixture({ webauthn });
    assert.ok([403, 409].includes((await f.register()).result.status));
    assert.equal(f.mints.length, 0);
    assert.equal([...f.documents.keys()].some(path => path.includes("/credentials/")), false);
  }
  for (const mutate of [user => { user.disabled = true; }, user => { user.customClaims.admin = false; },
    user => { user.customClaims.adminClaimVersion = "v2"; }, user => { user.customClaims.adminSecurityKeyUntil = START + 1000; },
    user => { user.customClaims.adminSecurityKeyRoleVersion = "admin-v1"; }]) {
    const f = fixture(); mutate(f.authUsers.admin);
    assert.equal((await f.register()).result.status, 403);
    assert.equal(f.mints.length, 0);
    assert.equal(f.documents.get("users/admin").adminSecurityKeyRequired, undefined);
    assert.equal([...f.documents.keys()].some(path => path.includes("/credentials/")), false);
  }
});

test("parallel assertions compare credential revision, including zero-counter keys; only one proof is minted", async () => {
  let arrived = 0, release;
  const barrier = new Promise(resolve => { release = resolve; });
  const webauthn = { ...realWebAuthn, async verifyAuthenticationResponse(options) {
    const result = await realWebAuthn.verifyAuthenticationResponse(options);
    if (++arrived === 2) release();
    await barrier; return result;
  } };
  const f = fixture({ webauthn }); const key = await f.enroll();
  const one = await f.options("authentication"), two = await f.options("authentication");
  const results = await Promise.all([one, two].map(ceremony => f.request({ action: "authentication-verify", challengeId: ceremony.challengeId,
    response: key.authentication(ceremony.options.challenge, { counter: 0 }) })));
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
  assert.equal(results.find(result => result.status === 409).body.error, "security-key-concurrent-use");
  assert.equal(f.mints.length, 2);
  assert.equal(f.documents.get(`adminSecurityKeys/admin/credentials/${hash(key.id)}`).revision, 1);
});

test("parallel first enrollments cannot turn bootstrap into backup enrollment; parallel fifth key stays bounded", async () => {
  const f = fixture();
  const ceremonies = await Promise.all([f.options("registration"), f.options("registration")]);
  const keys = [keyFixture(), keyFixture()];
  const results = await Promise.all(ceremonies.map((ceremony, i) => f.request({ action: "registration-verify",
    challengeId: ceremony.challengeId, response: keys[i].registration(ceremony.options.challenge) })));
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
  assert.equal([...f.documents.keys()].filter(path => path.includes("/credentials/")).length, 1);
  Object.assign(f.token, f.mints[0].claims);
  for (let i = 1; i < 4; i++) assert.equal((await f.register()).result.status, 200);
  const backups = await Promise.all([f.options("registration"), f.options("registration")]);
  const backupResults = await Promise.all(backups.map(ceremony => f.request({ action: "registration-verify", challengeId: ceremony.challengeId,
    response: keyFixture().registration(ceremony.options.challenge) })));
  assert.deepEqual(backupResults.map(result => result.status).sort(), [200, 409]);
  assert.equal([...f.documents.keys()].filter(path => path.includes("/credentials/")).length, 5);
});

test("endpoint bounds method/body/actions, never accepts client policy or RP override, redacts dependency errors and rate limits", async () => {
  const f = fixture();
  for (const [body, override, expected] of [[{ action: "status" }, { method: "GET" }, 405],
    [{ action: "status" }, { headers: { "content-type": "text/plain" } }, 415],
    [{ action: "status", adminSecurityKeyRequired: false }, {}, 400],
    [{ action: "registration-options", rpID: "localhost" }, {}, 400],
    [{ action: "delete-all" }, {}, 400], [{ action: "password-fallback" }, {}, 400],
    [{ action: "status", padding: "x".repeat(65536) }, {}, 413],
    [{ action: "status" }, { rawBody: Buffer.alloc(65537) }, 413],
    [{ action: "status" }, { headers: { "content-type": "application/json", origin: "https://evil.invalid" } }, 403]]) {
    assert.equal((await f.request(body, override)).status, expected);
  }
  assert.equal(f.writes.length, 0); assert.equal(f.rates.length, 0);
  f.rateError = { status: 429, message: "secret-internal-detail" };
  assert.equal((await f.request({ action: "status" })).status, 429);
  f.rateError = null; f.appCheckError = { status: 401, message: "secret-token" };
  const appError = await f.request({ action: "status" }); assert.equal(appError.status, 401);
  assert.equal(JSON.stringify(appError.body).includes("secret"), false);
  f.appCheckError = null; f.identityError = new Error("secret-stack-token");
  const error = await f.request({ action: "status" }); assert.equal(error.status, 500);
  assert.equal(JSON.stringify(error.body).includes("secret"), false);
  assert.throws(() => createAdminSecurityKeysHandler({ ...f.deps, testConfig: { rpID: "evil.invalid", origin: "https://evil.invalid" } }), TypeError);
});

test("malformed explicit policy and transport metadata fail closed before crypto or credential writes", async () => {
  for (const policy of [{ adminSecurityKeyRequired: null }, { adminSecurityKeyRequired: "false" },
    { adminSecurityKeyRequired: 0 }, { adminSecurityKeyRequired: true },
    { adminSecurityKeyRequired: true, adminSecurityKeyVersion: "" },
    { adminSecurityKeyRequired: false, adminSecurityKeyVersion: 1 }]) {
    const f = fixture(); Object.assign(f.documents.get("users/admin"), policy);
    for (const action of ["status", "registration-options", "authentication-options"]) {
      assert.equal((await f.request({ action })).status, 403, JSON.stringify(policy));
    }
    assert.equal(f.writes.length, 0); assert.equal(f.mints.length, 0);
  }
  const f = fixture(); const key = keyFixture(); const ceremony = await f.options("registration");
  for (const transports of ["usb", 1, {}, null, ["usb", {}], ["unrecognized"], Array(9).fill("usb")]) {
    const response = key.registration(ceremony.options.challenge); response.response.transports = transports;
    assert.equal((await f.request({ action: "registration-verify", challengeId: ceremony.challengeId, response })).status, 400);
    assert.equal(f.documents.get(`adminSecurityKeyChallenges/${ceremony.challengeId}`).usedAt, null);
  }
  assert.equal(f.mints.length, 0);
});

test("authentication rechecks revocation and expiry after crypto, and profile changes during SDK mint check cannot issue proof", async () => {
  for (const change of [f => { f.documents.get("users/admin").role = "client"; },
    f => { f.documents.get("users/admin").adminClaimVersion = "changed"; },
    f => { f.documents.get("users/admin").adminSecurityKeyVersion = "changed"; },
    f => { f.time(START + 300001); }]) {
    let f;
    f = fixture({ webauthn: { ...realWebAuthn, async verifyAuthenticationResponse(options) {
      const result = await realWebAuthn.verifyAuthenticationResponse(options); change(f); return result;
    } } });
    const key = await f.enroll(); const ceremony = await f.options("authentication");
    const result = await f.request({ action: "authentication-verify", challengeId: ceremony.challengeId,
      response: key.authentication(ceremony.options.challenge) });
    assert.ok([403, 409].includes(result.status)); assert.equal(f.mints.length, 1);
    assert.equal(f.documents.get(`adminSecurityKeys/admin/credentials/${hash(key.id)}`).counter, 0);
  }
  const f = fixture();
  f.onGetUser = () => { f.documents.get("users/admin").active = false; };
  assert.equal((await f.register()).result.status, 403); assert.equal(f.mints.length, 0);
});

test("session revocation during WebAuthn cannot mint a new custom token; legacy admin role remains bound", async () => {
  const first = fixture();
  first.onGetUser = () => { first.authUsers.admin.tokensValidAfterTime = new Date(START + 1000).toISOString(); };
  assert.equal((await first.register()).result.status, 403); assert.equal(first.mints.length, 0);
  assert.equal(first.documents.get("users/admin").adminSecurityKeyRequired, undefined);
  assert.equal([...first.documents.keys()].some(path => path.includes("/credentials/")), false);
  const f = fixture(); const key = await f.enroll(); const ceremony = await f.options("authentication");
  f.onGetUser = () => { f.authUsers.admin.tokensValidAfterTime = new Date(START + 1000).toISOString(); };
  assert.equal((await f.request({ action: "authentication-verify", challengeId: ceremony.challengeId,
    response: key.authentication(ceremony.options.challenge) })).status, 403);
  assert.equal(f.mints.length, 1);
  assert.equal(f.documents.get(`adminSecurityKeys/admin/credentials/${hash(key.id)}`).counter, 0);
  const late = fixture(); const lateKey = await late.enroll();
  const lateCeremony = await late.options("authentication"); let sdkChecks = 0;
  late.onGetUser = () => {
    if (++sdkChecks === 2) late.authUsers.admin.tokensValidAfterTime = new Date(START + 1000).toISOString();
  };
  assert.equal((await late.request({ action: "authentication-verify", challengeId: lateCeremony.challengeId,
    response: lateKey.authentication(lateCeremony.options.challenge) })).status, 403);
  assert.equal(sdkChecks, 2); assert.equal(late.mints.length, 1);
  const legacy = fixture();
  delete legacy.token.adminClaimVersion; delete legacy.documents.get("users/admin").adminClaimVersion;
  delete legacy.authUsers.admin.customClaims.adminClaimVersion;
  await legacy.enroll();
  assert.equal(legacy.mints.at(-1).claims.adminSecurityKeyRoleVersion, "legacy");
  assert.equal((await legacy.request({ action: "registration-options" })).status, 200);
  const current = fixture(); await current.enroll();
  current.documents.get("users/admin").adminClaimVersion = "admin-v2";
  current.token.adminClaimVersion = "admin-v2";
  current.authUsers.admin.customClaims.adminClaimVersion = "admin-v2";
  assert.equal((await current.request({ action: "registration-options" })).status, 403);
  assert.equal((await current.request({ action: "status" })).body.verifiedUntil, null);
});
