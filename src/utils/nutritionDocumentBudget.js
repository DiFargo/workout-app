// Conservative UTF-8 JSON envelope, not an exact Firestore wire-size claim.
// Keep headroom for Firestore field/index overhead; never truncate history or
// discard tombstones to make a document fit.
export const NUTRITION_DOCUMENT_MIGRATION_BYTES = 600 * 1024;
export const NUTRITION_DOCUMENT_MAX_BYTES = 750 * 1024;

export function measureNutritionDocument(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
  return { bytes, migrationRequired: bytes >= NUTRITION_DOCUMENT_MIGRATION_BYTES };
}

export function assertNutritionDocumentBudget(value) {
  const result = measureNutritionDocument(value);
  if (result.migrationRequired) {
    console.warn("[nutrition_document_migration_required]", { bytes: result.bytes, threshold: NUTRITION_DOCUMENT_MIGRATION_BYTES });
  }
  if (result.bytes >= NUTRITION_DOCUMENT_MAX_BYTES) {
    const error = new Error("История питания требует переноса в архив. Данные сохранены на устройстве; обратитесь в поддержку.");
    error.code = "nutrition/archive-required";
    error.bytes = result.bytes;
    throw error;
  }
  return result;
}
