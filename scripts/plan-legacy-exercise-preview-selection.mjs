// Pure planning only: no credentials, network calls or production writes.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { exerciseCardLegacyKey, exerciseCardMetadata } from "../functions/exerciseCards.js";
import { manageTrainerExerciseCards } from "../functions/trainerExerciseCards.js";
import { resolveProtectedExerciseVideoSource } from "../functions/protectedExerciseVideo.js";

const project = "tren-85720";
const documents = `projects/${project}/databases/(default)/documents`;
const allowedLabels = new Set(["V074", "V075"]);
const hash = value => createHash("sha256").update(value).digest("hex");
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);

export function encodeLegacyPreviewValue(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    assert.ok(Number.isFinite(value), "Non-finite Firestore number");
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeLegacyPreviewValue) } };
  assert.ok(value && Object.getPrototypeOf(value) === Object.prototype, "Unsupported Firestore value");
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, child]) => [key, encodeLegacyPreviewValue(child)])) } };
}

function allExercises(value) {
  if (Array.isArray(value)) return value.flatMap(allExercises);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => key === "exercises" && Array.isArray(child) ? child : allExercises(child));
}

function planningDatabase(current) {
  const records = new Map([
    ...current.trainingTemplates.map(template => [`trainingTemplates/${template.id}`, template]),
    ...current.trainerExerciseCards.map(card => [`trainerExerciseCards/${card.id}`, card])
  ]);
  const writes = [];
  return { writes, db: {
    collection(collection) {
      assert.ok(["trainingTemplates", "trainerExerciseCards"].includes(collection), "Library-only adapter");
      return { doc(id) { return { path: `${collection}/${id}` }; } };
    },
    async runTransaction(callback) {
      return callback({
        async get(ref) {
          // Even malformed/revisionless existing records must never be replaced.
          if (ref.path.startsWith("trainerExerciseCards/") && records.has(ref.path)) {
            throw Object.assign(new Error("Existing shared card must not be overwritten"), { code: "existing_card" });
          }
          return { exists: records.has(ref.path), data: () => structuredClone(records.get(ref.path)) };
        },
        set(ref, card) {
          assert.ok(ref.path.startsWith("trainerExerciseCards/") && !records.has(ref.path));
          writes.push({ path: ref.path, card: structuredClone(card) });
          records.set(ref.path, structuredClone(card));
        }
      });
    }
  } };
}

export async function planLegacyPreviewWrites(frozen, current, candidates, decisions, now) {
  const entries = frozen.entries.filter(entry => entry.type === "legacy" && entry.status === "needs_selection" && entry.videoRef);
  assert.ok(entries.length <= 2 && entries.every(entry => allowedLabels.has(entry.videoLabel)), "Only reviewed V074/V075 legacy sources are permitted");
  const changes = [], skipped = [], verifications = [];
  const adapter = planningDatabase(current);
  for (const entry of entries) {
    const skip = reason => skipped.push({ type: "legacy", id: entry.id, sourceTemplateId: entry.templateId, name: entry.name, reason });
    const template = current.trainingTemplates.find(template => template.id === entry.templateId);
    if (!template || template._updateTime !== entry.updateTime || template.ownerUid !== entry.ownerUid) { skip("changed_since_review"); continue; }
    assert.equal(template._document, `${documents}/trainingTemplates/${entry.templateId}`, "Unexpected source template path");
    assert.ok(template._updateTime, "Source updateTime required");
    const matches = allExercises(template).filter(exercise => exercise.id === entry.id && hash(exerciseCardLegacyKey(exercise)) === entry.legacyHash);
    if (!matches.length || new Set(matches.map(exercise => canonical(exerciseCardMetadata(exercise)))).size !== 1) { skip("changed_or_ambiguous_source"); continue; }
    const source = matches[0], metadata = exerciseCardMetadata(source);
    if (source.libraryDeletedAt || Number.isFinite(source.videoPosterTime) || metadata.videoPoster || metadata.videoThumbnail
      || canonical(metadata.videoCrop) !== canonical(entry.crop ?? null) || metadata.videoPosterTime !== (entry.posterTime ?? null)) {
      skip("changed_since_review"); continue;
    }
    const media = resolveProtectedExerciseVideoSource(metadata.video);
    if (`gs://${media.bucket}/${media.objectPath}` !== entry.videoRef) { skip("changed_since_review"); continue; }
    // Do not create a duplicate if another card has acquired this legacy key.
    const legacyKey = exerciseCardLegacyKey(source);
    if (current.trainerExerciseCards.some(card => card.ownerUid === template.ownerUid && (card.legacyKeys || []).includes(legacyKey))) {
      skip("existing_card"); continue;
    }
    const candidate = candidates.find(candidate => candidate.videos.includes(entry.videoLabel));
    assert.ok(candidate && !candidate.error, `No decoded candidates for ${entry.videoLabel}`);
    assert.equal(canonical(candidate.crop ?? null), canonical(entry.crop ?? null), `Unreviewed crop for ${entry.videoLabel}`);
    const decision = decisions[candidate.label];
    if (decision?.skip === true) { skip(decision.reason || "unsuitable_source"); continue; }
    assert.ok(decision && Number.isInteger(decision.choice) && decision.choice >= 1 && decision.choice <= 6 && decision.reason, `Missing visual review: ${candidate.label}`);
    const time = candidate.times[decision.choice - 1];
    assert.ok(Number.isFinite(time) && time >= 0 && time < candidate.duration && time <= 86400);
    let card;
    try {
      ({ card } = await manageTrainerExerciseCards({ db: adapter.db,
        context: { uid: "system-preview-selection", token: { admin: true } },
        body: { action: "save", templateId: template.id, exerciseId: source.id, legacyKey, patch: { videoPosterTime: time } },
        now: () => now }));
    } catch (error) {
      if (error.code === "existing_card") { skip("existing_card"); continue; }
      throw error;
    }
    assert.equal(adapter.writes.at(-1).path, `trainerExerciseCards/${card.id}`);
    // The backend's creation timestamp is not evidence of a new video. Unknown
    // legacy age must remain priority=0, not inherit either now or template age.
    card.videoUpdatedAt = source.videoUpdatedAt || "1970-01-01T00:00:00.000Z";
    changes.push({ type: "legacy_card", id: card.id, sourceTemplateId: template.id, name: card.name,
      label: candidate.label, choice: decision.choice, reason: decision.reason, time: card.videoPosterTime,
      before: {}, expectedCard: card,
      write: { update: { name: `${documents}/trainerExerciseCards/${card.id}`,
        fields: encodeLegacyPreviewValue(card).mapValue.fields }, currentDocument: { exists: false } } });
    // These are local transaction read requirements, NOT Firestore Write
    // objects. The caller must read the templates in its transaction, compare
    // updateTime, and commit these creates using that same transaction token.
    if (!verifications.some(item => item.name === template._document)) verifications.push({ name: template._document,
      updateTime: template._updateTime });
  }
  return { project, preparedAt: now, changes, skipped, verifications };
}
