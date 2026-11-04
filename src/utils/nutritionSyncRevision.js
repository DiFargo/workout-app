import { captureAuthSession } from "./authSession.js";
import { addUserLocalBackup, safeReadUserJsonStorage, safeWriteUserJsonStorage } from "./userScopedStorage.js";
import { mergeNutritionStates } from "./nutritionStateMerge.js";

const revisions = new WeakMap();
const saveFeedbackListeners = new Set();

// Compare persisted JSON meaning, not insertion order or React object identity.
export function nutritionStateFingerprint(value) {
  return JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}

export function sameNutritionState(a, b) {
  return nutritionStateFingerprint(a) === nutritionStateFingerprint(b);
}

function scopedState(auth, value) {
  return { ...value, __uid: auth.currentUser?.uid || "", updatedAt: value?.updatedAt || "" };
}

function getRevision(auth) {
  let revision = revisions.get(auth);
  if (!revision?.session.isUnchanged()) {
    revision = { session: captureAuthSession(auth), cloud: null, cloudRevision: 0, saveSequence: 0, acknowledgedSequence: 0,
      localFingerprint: null, localSaved: null, dirty: true, feedbackError: "", feedback: null,
      feedbackSequence: 0, feedbackAcknowledged: 0, feedbackSaves: new Set() };
    revisions.set(auth, revision);
  }
  return revision;
}

function publishSaveFeedback(revision) {
  if (!revision.session.isCurrent()) return;
  const sending = revision.feedbackSaves.size > 0;
  const state = revision.localSaved === false && revision.dirty ? "error"
    : sending ? "saving" : revision.feedbackError ? "error"
      : revision.dirty ? "local" : "cloud";
  const next = { state, localSaved: revision.localSaved, sending,
    errorCode: revision.feedbackError, requiresConfirmation: revision.feedbackError === "nutrition/rebase-required" };
  if (JSON.stringify(next) === JSON.stringify(revision.feedback)) return;
  revision.feedback = next;
  saveFeedbackListeners.forEach(listener => listener());
}

export function subscribeNutritionSaveFeedback(listener) {
  saveFeedbackListeners.add(listener);
  return () => saveFeedbackListeners.delete(listener);
}

export function getNutritionSaveFeedback(auth) {
  const revision = revisions.get(auth);
  return revision?.session.isCurrent() ? revision.feedback : null;
}

export function rememberNutritionLocalSave(auth, value, { localSaved, queued = false, cloudConfirmed = false }) {
  const revision = getRevision(auth);
  if (!revision.session.isCurrent() || value?.__uid && value.__uid !== revision.session.uid) return;
  const fingerprint = nutritionStateFingerprint(value);
  if (revision.localFingerprint !== fingerprint) revision.feedbackError = "";
  revision.localFingerprint = fingerprint;
  revision.localSaved = localSaved || queued;
  revision.dirty = !cloudConfirmed;
  if (!revision.localSaved && revision.dirty) revision.feedbackError = "nutrition/local-storage-failed";
  else if (cloudConfirmed || revision.feedbackError === "nutrition/local-storage-failed") revision.feedbackError = "";
  publishSaveFeedback(revision);
}

export function beginNutritionSaveFeedback(auth, uid, value) {
  const revision = getRevision(auth);
  if (uid !== revision.session.uid || !revision.session.isCurrent() || value?.__uid && value.__uid !== uid) return null;
  const ticket = { revision, session: revision.session, sequence: ++revision.feedbackSequence,
    fingerprint: nutritionStateFingerprint(value) };
  if (revision.localFingerprint === null) {
    revision.localFingerprint = ticket.fingerprint;
    revision.dirty = true;
  }
  revision.feedbackSaves.add(ticket);
  if (revision.feedbackError !== "nutrition/local-storage-failed") revision.feedbackError = "";
  publishSaveFeedback(revision);
  return ticket;
}

export function finishNutritionSaveFeedback(auth, ticket, failure = null) {
  if (!ticket?.session.isCurrent() || revisions.get(auth) !== ticket.revision) return;
  const revision = ticket.revision;
  revision.feedbackSaves.delete(ticket);
  if (ticket.sequence >= revision.feedbackAcknowledged) {
    if (!failure) {
      revision.feedbackAcknowledged = ticket.sequence;
      // A server acknowledgement belongs only to the snapshot it sent. A new
      // edit must remain local even while an older request finishes.
      if (revision.localFingerprint === ticket.fingerprint) {
        revision.dirty = false;
        revision.feedbackError = "";
      }
    } else if (revision.dirty && revision.localFingerprint === ticket.fingerprint) {
      revision.feedbackError = revision.localSaved === false ? "nutrition/local-storage-failed"
        : failure.code || "nutrition/save-failed";
    }
  }
  publishSaveFeedback(revision);
}

export function rememberNutritionCloudState(auth, value, { partial = false } = {}) {
  const revision = getRevision(auth);
  if (!revision.session.isCurrent()) return;
  const next = partial && revision.cloud ? { ...mergeNutritionStates(JSON.parse(revision.cloud), value),
    ...(value?.__nutritionStorage ? { __nutritionStorage: value.__nutritionStorage } : {}) } : value;
  revision.cloud = nutritionStateFingerprint(scopedState(auth, next));
  revision.cloudRevision++;
}

export function isNutritionStateDirty(auth, value) {
  const revision = getRevision(auth);
  return revision.cloud === null ? Boolean(value?.updatedAt)
    : revision.cloud !== nutritionStateFingerprint(scopedState(auth, value));
}

export function hasConfirmedNutritionCloudState(auth) {
  const revision = revisions.get(auth);
  return Boolean(revision?.session.isCurrent() && revision.cloud !== null);
}

export function beginNutritionSave(auth) {
  const revision = getRevision(auth);
  return { revision, sequence: ++revision.saveSequence, session: revision.session };
}

export function acknowledgeNutritionCloudState(auth, ticket, value) {
  if (!ticket.session.isCurrent() || revisions.get(auth) !== ticket.revision
    || ticket.sequence < ticket.revision.acknowledgedSequence) return;
  ticket.revision.acknowledgedSequence = ticket.sequence;
  rememberNutritionCloudState(auth, value);
}

export function persistNutritionLocalSnapshot(key, uid, value) {
  const previous = safeReadUserJsonStorage(key, uid, null);
  return sameNutritionState(previous, value) || safeWriteUserJsonStorage(key, uid, value);
}

export function backupNutritionLocalSnapshot(key, uid, value) {
  const previous = safeReadUserJsonStorage(key, uid, []);
  if (Array.isArray(previous) && sameNutritionState(previous[0]?.nutrition, value)) return true;
  // One complete recoverable snapshot per content change, including My Foods.
  return Boolean(addUserLocalBackup(key, uid, { nutrition: value }, 12));
}
