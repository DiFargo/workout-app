import assert from "node:assert/strict";
import { accountToken } from "./exercise-preview-batch.mjs";
assert.ok(process.argv.includes("--project=tren-85720"), "Explicit production project required");
const token = await accountToken();
const url = "https://firestore.googleapis.com/v1/projects/tren-85720/databases/(default)/collectionGroups/feedback/fields/createdAt";
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const current = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
assert.equal(current.status, 200);
const field = await current.json();
const indexes = (field.indexConfig?.indexes || []).map(index => ({ queryScope: index.queryScope, fields: index.fields }));
const exists = indexes.some(index => index.queryScope === "COLLECTION_GROUP" && index.fields.some(field => field.fieldPath === "createdAt" && field.order === "DESCENDING"));
if (!exists && process.argv.includes("--apply")) {
  const response = await fetch(url + "?updateMask=indexConfig", { method: "PATCH", headers,
    body: JSON.stringify({ indexConfig: { indexes: [...indexes, { queryScope: "COLLECTION_GROUP", fields: [{ fieldPath: "createdAt", order: "DESCENDING" }] }] } }),
    signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200);
  const operation = await response.json();
  console.log(JSON.stringify({ project: "tren-85720", created: true, operation: operation.name, previousIndexesPreserved: indexes.length }));
} else console.log(JSON.stringify({ project: "tren-85720", exists, apply: false, previousIndexes: indexes.length }));
