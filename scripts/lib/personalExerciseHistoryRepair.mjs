// Pure, explicitly owner-scoped maintenance planning. Historical result fields
// stay in their original Firestore wire representation, including timestamps.
import {isDeepStrictEqual} from "node:util";
const ARRAYS = ["exercises", "actualExercises", "completedExercises", "exerciseResults", "results"];
const LINK_FIELDS = ["exerciseCardId", "exerciseCardOwnerUid"];
const normal = value => String(value || "").normalize("NFKC").trim().toLowerCase().replaceAll("ё", "е").replace(/\s+/g, " ");
const string = (fields, key) => fields?.[key]?.stringValue || "";
const exerciseName = fields => string(fields, "name") || string(fields, "title") || string(fields, "exerciseName");
const reject = code => {throw new Error(`personal-history/${code}`);};
const check = (value, code) => {if (!value) reject(code);};
const same = isDeepStrictEqual;
const CONSTRAINT_FIELDS = ["equipment", "weightMode", "loadMode", "weightMultiplier", "usesWeight", "requiresWeight"];
const historicalIdentity = fields => ["id", "exerciseId", "basicExerciseId", "basicExerciseLibraryId", "libraryExerciseId", "catalogueId", "sourceId", "sourceExerciseId", "originalExerciseId"]
  .map(key => string(fields, key)).find(Boolean) || `name:${normal(exerciseName(fields))}`;

export function buildPersonalExerciseHistoryRepair({project, uid, profileDocument, workoutDocuments, historyDocuments, aliases = [], includeExactNames = false}) {
  check(project === "tren-85720" && typeof uid === "string" && uid && uid.length <= 128 && !uid.includes("/"), "invalid-owner");
  const ownerPath = `projects/${project}/databases/(default)/documents/users/${uid}`;
  check(profileDocument?.name === ownerPath && profileDocument.updateTime, "profile-scope");
  const owns = (document, collection) => typeof document?.name === "string" && document.name.startsWith(`${ownerPath}/${collection}/`)
    && document.name.slice(`${ownerPath}/${collection}/`.length).length > 0
    && !document.name.slice(`${ownerPath}/${collection}/`.length).includes("/") && document.updateTime;
  check(Array.isArray(workoutDocuments) && workoutDocuments.every(doc => owns(doc, "workouts")), "workout-scope");
  check(Array.isArray(historyDocuments) && historyDocuments.every(doc => owns(doc, "history")), "history-scope");
  check(new Set(historyDocuments.map(doc => doc.name)).size === historyDocuments.length, "duplicate-history-document");
  const version = string(profileDocument.fields, "assignedProgramUpdatedAt") || string(profileDocument.fields, "assignedProgramAt");
  check(version, "missing-active-assignment");
  const current = workoutDocuments.filter(doc => (string(doc.fields, "assignedProgramUpdatedAt") || string(doc.fields, "assignmentVersion")) === version);
  check(current.length > 0, "missing-current-workouts");
  const targets = new Map(), targetDocuments = new Set();
  for (const document of current) for (const value of document.fields?.exercises?.arrayValue?.values || []) {
    const fields = value.mapValue?.fields || {}, name = normal(exerciseName(fields));
    const card = string(fields, LINK_FIELDS[0]), owner = string(fields, LINK_FIELDS[1]);
    if (!name || !card || !owner) continue;
    if (!targets.has(name)) targets.set(name, new Map());
    const key = `${owner}:${card}`, previous = targets.get(name).get(key);
    const constraints = value => CONSTRAINT_FIELDS.map(field => value?.[field] ?? null);
    if (previous && !same(constraints(previous.fields), constraints(fields))) {
      targets.get(name).set(`${key}:conflicting-copy:${document.name}`, {fields, name: exerciseName(fields), card, owner, documents: [document]});
    } else if (previous) previous.documents.push(document);
    else targets.get(name).set(key, {fields, name: exerciseName(fields), card, owner, documents: [document]});
  }
  const namesByCard = new Map();
  for (const [name, variants] of targets) for (const target of variants.values()) {
    const key = `${target.owner}:${target.card}`;
    if (!namesByCard.has(key)) namesByCard.set(key, new Set());
    namesByCard.get(key).add(name);
  }
  for (const [name, variants] of targets) if ([...variants.values()].some(target => namesByCard.get(`${target.owner}:${target.card}`).size > 1)) targets.delete(name);
  const aliasMap = new Map();
  for (const {from, to} of aliases) {
    const source = normal(from), target = normal(to);
    check(source && target && !aliasMap.has(source), "ambiguous-alias");
    check(targets.get(target)?.size === 1, "alias-target-unavailable");
    aliasMap.set(source, target);
  }
  const changes = [], skipped = [], linked = [], alreadyLinked = [];
  for (const document of historyDocuments) {
    const updates = {}, repairs = [];
    for (const field of ARRAYS) {
      const original = document.fields?.[field];
      if (!original?.arrayValue) continue;
      const replacement = structuredClone(original), planned = [];
      for (const [index, value] of (replacement.arrayValue.values || []).entries()) {
        const fields = value.mapValue?.fields;
        if (!fields) continue;
        const name = exerciseName(fields), key = normal(name), targetKey = aliasMap.get(key) || (includeExactNames ? key : "");
        if (!targetKey) continue;
        const matches = targets.get(targetKey);
        if (matches?.size !== 1) {skipped.push({name, reason: "no-unique-current-card"});continue;}
        const target = matches.values().next().value;
        const present = LINK_FIELDS.filter(key => Object.hasOwn(fields, key));
        if (present.length) {
          if (present.length === 2 && string(fields, LINK_FIELDS[0]) === target.card && string(fields, LINK_FIELDS[1]) === target.owner) {
            alreadyLinked.push({name, targetName: target.name});
          } else skipped.push({name, reason: "existing-or-partial-card-identity"});
          continue;
        }
        const conflict = CONSTRAINT_FIELDS.some(key =>
          Object.hasOwn(fields, key) && Object.hasOwn(target.fields, key) && !same(fields[key], target.fields[key]));
        if (conflict) {skipped.push({name, reason: "explicit-equipment-or-load-conflict"});continue;}
        planned.push({index, name, target});
      }
      const cards = planned.map(item => `${item.target.owner}:${item.target.card}`);
      const existingCards = (original.arrayValue.values || []).flatMap(item => {
        const fields = item.mapValue?.fields;
        const card = string(fields, LINK_FIELDS[0]), owner = string(fields, LINK_FIELDS[1]);
        return card && owner ? [`${owner}:${card}`] : [];
      });
      if (new Set(cards).size !== cards.length || cards.some(card => existingCards.includes(card))) {
        skipped.push(...planned.map(item => ({name: item.name, reason: "multiple-slots-would-collapse"})));continue;
      }
      for (const {index, name, target} of planned) {
        const fields = replacement.arrayValue.values[index].mapValue.fields;
        fields.exerciseCardId = {stringValue: target.card};fields.exerciseCardOwnerUid = {stringValue: target.owner};
        target.documents.forEach(document => targetDocuments.add(document.name));
        const repair = {field, index, name, targetName: target.name, card: target.card, owner: target.owner};
        repairs.push(repair);
      }
      if (planned.length) updates[field] = replacement;
    }
    // The trainer deduplicates across all actual arrays. A mirror recording of
    // the same original slot is fine; distinct slots must not collapse merely
    // because they received the same new card.
    const byCard = new Map(), byPosition = new Map(repairs.map(item => [`${item.field}:${item.index}`, item]));
    for (const field of ARRAYS) for (const [index, value] of (document.fields?.[field]?.arrayValue?.values || []).entries()) {
      const fields = value.mapValue?.fields || {}, repair = byPosition.get(`${field}:${index}`);
      const card = repair?.card || string(fields, LINK_FIELDS[0]), owner = repair?.owner || string(fields, LINK_FIELDS[1]);
      if (!card || !owner) continue;
      const key = `${owner}:${card}`;
      if (!byCard.has(key)) byCard.set(key, new Set());
      byCard.get(key).add(historicalIdentity(fields));
    }
    for (let index = repairs.length - 1; index >= 0; index--) {
      const repair = repairs[index];
      if ((byCard.get(`${repair.owner}:${repair.card}`)?.size || 0) <= 1) continue;
      LINK_FIELDS.forEach(key => {delete updates[repair.field].arrayValue.values[repair.index].mapValue.fields[key];});
      skipped.push({name: repair.name, reason: "cross-array-slots-would-collapse"});repairs.splice(index, 1);
    }
    for (const field of Object.keys(updates)) if (same(updates[field], document.fields[field])) delete updates[field];
    if (repairs.length) {
      linked.push(...repairs.map(repair => ({...repair, documentName: document.name})));
      changes.push({documentName: document.name, updateTime: document.updateTime, updates, repairs, original: document});
    }
  }
  const verify = [profileDocument, ...current.filter(doc => targetDocuments.has(doc.name))]
    .map(document => ({verify: document.name, currentDocument: {updateTime: document.updateTime}}));
  const writes = changes.map(change => ({update: {name: change.documentName, fields: change.updates},
    updateMask: {fieldPaths: Object.keys(change.updates)}, currentDocument: {updateTime: change.updateTime}}));
  check(writes.length + verify.length <= 450, "write-budget");
  const plan = {ownerPath, changes, linked, skipped, alreadyLinked, verify, writes};
  for (const change of changes) assertPersonalRepairPreservesResults(change.original, {...change.original, fields: {...change.original.fields, ...change.updates}}, change.repairs);
  return plan;
}

export function assertPersonalRepairPreservesResults(before, after, repairs) {
  check(before.name === after.name, "changed-document-identity");
  const restored = structuredClone(after.fields);
  for (const repair of repairs) {
    const original = before.fields?.[repair.field]?.arrayValue?.values?.[repair.index]?.mapValue?.fields;
    const current = restored?.[repair.field]?.arrayValue?.values?.[repair.index]?.mapValue?.fields;
    check(original && current && LINK_FIELDS.every(key => !Object.hasOwn(original, key)), "unexpected-original-card");
    check(string(current, LINK_FIELDS[0]) === repair.card && string(current, LINK_FIELDS[1]) === repair.owner, "wrong-added-card");
    LINK_FIELDS.forEach(key => {delete current[key];});
  }
  check(same(before.fields, restored), "historical-result-changed");
  return true;
}

export function summarizePersonalRepair(plan) {
  const groups = new Map();
  for (const item of plan.linked) {
    const key = `${item.name} → ${item.targetName}`;
    groups.set(key, (groups.get(key) || 0) + 1);
  }
  const skipped = new Map();
  for (const item of plan.skipped) skipped.set(item.reason, (skipped.get(item.reason) || 0) + 1);
  return {changedHistoryDocuments: plan.changes.length, addedExerciseLinks: plan.linked.length, alreadyLinked: plan.alreadyLinked.length,
    mappings: [...groups].map(([mapping, count]) => ({mapping, count})), skipped: Object.fromEntries(skipped), actualResultsPreserved: true};
}
