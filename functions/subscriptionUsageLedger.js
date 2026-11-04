import { createHash } from "node:crypto";

const LEDGER_COLLECTION = "subscriptionUsageLedger";
const fail = message => { throw new Error(`subscription-usage-ledger: ${message}`); };

// Generation identity must retain nanoseconds. Client-written createdAt/date
// and CloudEvent delivery time are NOT a document generation identifier.
function generationTime(timestamp) {
  const seconds = timestamp?.seconds;
  const nanoseconds = timestamp?.nanoseconds;
  if (!Number.isSafeInteger(seconds) || !Number.isInteger(nanoseconds) || nanoseconds < 0 || nanoseconds >= 1e9) {
    fail("snapshot.createTime with seconds/nanoseconds is required");
  }
  return { key: `${seconds}:${String(nanoseconds).padStart(9, "0")}`, nanos: BigInt(seconds) * 1000000000n + BigInt(nanoseconds) };
}

function instantNanos(value) {
  if (value && Number.isSafeInteger(value.seconds) && Number.isInteger(value.nanoseconds)) return generationTime(value).nanos;
  const millis = value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(String(value || ""));
  return Number.isFinite(millis) ? BigInt(Math.trunc(millis)) * 1000000n : null;
}

function cycleIdentity(subscription) {
  return String(subscription?.cycleId || subscription?.lastRenewedAt || subscription?.startDate || "legacy");
}

function cycleBoundary(subscription) {
  const explicit = instantNanos(subscription.cycleStartedAt) ?? instantNanos(subscription.lastRenewedAt);
  if (explicit !== null) return explicit;
  const generatedCycle = /^cycle_(\d{10,})$/.exec(String(subscription.cycleId || ""));
  return generatedCycle ? instantNanos(Number(generatedCycle[1])) : null;
}

/**
 * Admin SDK handler for onDocumentCreated/onDocumentDeleted snapshots.
 *
 * cutoverTimestamp is a fixed deployment/migration constant, never Date.now().
 * Before cutover, existing balances are grandfathered: a frozen legacy marker
 * may seed ownership but NEVER increments usage. Unmarked legacy documents do
 * not change balances and require migration reconciliation outside this helper.
 * After cutover, all owner-written accounting markers are ignored.
 * A legacy delete also requires immutable CloudEvent time: deletes before the
 * baseline/cutover are tombstoned without another refund. A later delivery
 * time must never replace that occurrence time.
 *
 * The top-level collection must be server-only and tombstones must be retained.
 * Renewal must atomically reset usage, choose a new cycleId and set an immutable
 * cycleStartedAt/lastRenewedAt boundary (cycle_<milliseconds> is a compatibility
 * fallback). An initial named cycle without a boundary is rejected unless its
 * exact ID was frozen by the operator in the server-only initial baseline.
 * That exception uses cutover only as ledger activation; never reuse cycle IDs.
 */
export async function adjustSubscriptionUsageForHistoryEventWithLedger({
  db, FieldValue, getResourceDateKey, event, delta, cutoverTimestamp, baselineCycleId = "", accountingConfigRef = null
}) {
  if (![1, -1].includes(delta)) fail("delta must be 1 or -1");
  const uid = String(event?.params?.uid || "");
  const historyId = String(event?.params?.historyId || event?.data?.id || event?.data?.ref?.id || "");
  if (!uid || uid.includes("/") || !historyId || historyId.includes("/")) fail("uid/historyId required");
  const snapshot = event?.data;
  if (!snapshot?.ref || snapshot.ref.path !== `users/${uid}/history/${historyId}` || typeof snapshot.data !== "function") fail("history snapshot/ref mismatch");
  const generation = generationTime(snapshot.createTime);
  const cutover = instantNanos(cutoverTimestamp);
  if (cutover === null) fail("fixed cutoverTimestamp is required");
  if (accountingConfigRef && accountingConfigRef.path !== "serverConfig/subscriptionAccounting") fail("accounting config ref mismatch");
  const history = snapshot.data() || {};
  const legacy = generation.nanos < cutover;
  const deletionTime = delta < 0 && legacy ? instantNanos(event.time) : null;
  if (delta < 0 && legacy && deletionTime === null) fail("legacy delete requires immutable CloudEvent time");
  const ledgerId = createHash("sha256").update(JSON.stringify([uid, historyId, generation.key])).digest("hex");
  const ledgerRef = db.collection(LEDGER_COLLECTION).doc(ledgerId);
  const userRef = db.collection("users").doc(uid);

  return db.runTransaction(async transaction => {
    if (accountingConfigRef) {
      const configSnapshot = await transaction.get(accountingConfigRef);
      const config = configSnapshot.exists ? configSnapshot.data() || {} : {};
      if (config.schemaVersion !== 1 || config.baselineReady !== true || config.paused !== false ||
        instantNanos(config.cutoverTimestamp) !== cutover || (config.baselineCycleIds?.[uid] ?? "") !== (baselineCycleId ?? "")) {
        fail("accounting config changed or paused; retry with current fixed config");
      }
      // Including config in the transaction read set makes an operator pause
      // conflict with a concurrent balance/ledger commit, not merely its guard.
    }
    // All reads precede writes, including the generation check on a live create.
    const [ledgerSnap, userSnap, liveSnapshot] = await Promise.all([
      transaction.get(ledgerRef), transaction.get(userRef),
      delta > 0 ? transaction.get(snapshot.ref) : Promise.resolve(null)
    ]);
    const existing = ledgerSnap.exists ? ledgerSnap.data() : null;
    if (existing && (delta > 0 || existing.deleted)) return { action: "duplicate", ledgerId, appliedDelta: 0 };

    const user = userSnap.exists ? userSnap.data() || {} : {};
    const subscription = user.subscription || null;
    const currentCycle = subscription ? cycleIdentity(subscription) : "";
    const base = {
      schemaVersion: 1, uid, historyId, generation: generation.key,
      historyCreateTime: snapshot.createTime,
      updatedAt: FieldValue.serverTimestamp()
    };
    let entry = existing;
    let appliedDelta;

    if (delta > 0) {
      const liveGeneration = liveSnapshot?.exists ? generationTime(liveSnapshot.createTime).key : "";
      if (!legacy && liveGeneration !== generation.key) {
        transaction.set(ledgerRef, { ...base, deleted: true, counted: false, cycleId: "", reason: "generation-no-longer-live", createEventId: String(event.id || "") });
        return { action: "tombstoned", ledgerId, appliedDelta: 0 };
      }
      const legacyCycle = legacy ? String(history.subscriptionCycleId || "") : "";
      let eligible = Boolean(subscription);
      let reason = subscription ? "counted" : "no-subscription";
      if (!legacy && subscription) {
        let boundary = cycleBoundary(subscription);
        // Unknown named cycles cannot safely claim a delayed event. The
        // marker is not a substitute for the server's cycle boundary.
        if (boundary === null && subscription.cycleId && currentCycle !== "legacy") {
          // A one-time operator-frozen initial baseline may explicitly admit
          // this exact existing cycle. Cutover is only ledger activation here,
          // not an invented historical cycle start. Never reuse cycle IDs.
          if (typeof baselineCycleId !== "string" || !baselineCycleId || baselineCycleId !== currentCycle)
            fail("current subscription cycle needs cycleStartedAt/lastRenewedAt");
          boundary = cutover;
        }
        if (boundary !== null && generation.nanos < boundary) { eligible = false; reason = "before-current-cycle"; }
        const workoutDate = getResourceDateKey(history.date || history.finishedAt || history.createdAt);
        const startDate = getResourceDateKey(subscription.startDate);
        if (subscription.periodMode !== "sessions" && startDate && workoutDate && workoutDate < startDate) { eligible = false; reason = "before-period-start"; }
      }
      entry = {
        ...base, deleted: false, counted: legacy ? Boolean(legacyCycle) : eligible,
        cycleId: legacy ? legacyCycle : currentCycle,
        source: legacy ? "legacy-baseline" : "ledger-event",
        reason: legacy ? (legacyCycle ? "legacy-balance-already-counted" : "legacy-unmarked-no-recount") : reason,
        createEventId: String(event.id || "")
      };
      appliedDelta = !legacy && eligible ? 1 : 0;
    } else {
      // A delete delivered first is a terminal tombstone. A frozen pre-cutover
      // marker is the sole compatibility exception for an existing baseline.
      const legacyCycle = legacy ? String(history.subscriptionCycleId || "") : "";
      const owned = entry || { counted: Boolean(legacyCycle), cycleId: legacyCycle, source: legacy ? "legacy-baseline" : "ledger-event" };
      const alreadyInBaseline = legacy && deletionTime < cutover;
      appliedDelta = !alreadyInBaseline && subscription && owned.counted && owned.cycleId === currentCycle ? -1 : 0;
      entry = { ...owned, ...base, deleted: true, deleteEventId: String(event.id || ""), reason: alreadyInBaseline
        ? "legacy-delete-already-in-baseline" : appliedDelta ? "current-cycle-reversed" : "deleted-no-current-cycle-charge" };
    }

    if (appliedDelta && subscription) {
      const purchasedSessions = Math.max(0, Number(subscription.purchasedSessions || subscription.totalSessions) || 0);
      const currentUsed = Math.max(0, Number(subscription.usedSessions) || 0);
      const usedSessions = Math.max(0, currentUsed + appliedDelta);
      appliedDelta = usedSessions - currentUsed;
      transaction.set(userRef, { subscription: {
        usedSessions, remainingSessions: Math.max(0, purchasedSessions - usedSessions),
        updatedAt: FieldValue.serverTimestamp()
      } }, { merge: true });
    }
    transaction.set(ledgerRef, entry);
    return { action: delta > 0 ? "created" : "deleted", ledgerId, appliedDelta };
  });
}
