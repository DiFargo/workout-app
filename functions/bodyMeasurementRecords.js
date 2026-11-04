const BODY_FIELDS = ["neck", "shoulders", "shoulderGirth", "chest", "biceps", "forearm", "wrist", "belly", "waist", "pelvis", "hips", "thigh", "calf", "ankle"];

export function isBodyMeasurementRecord(record) {
  if (!record || typeof record !== "object" || record.measurementType === "weight_checkin") return false;
  if (record.measurementType === "body_measurement") return true;
  // Older records have no type: require a body circumference, not weight alone.
  return BODY_FIELDS.some((field) => [record[field], record.values?.[field]].some((value) => {
    const number = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(number) && number > 0;
  }));
}
