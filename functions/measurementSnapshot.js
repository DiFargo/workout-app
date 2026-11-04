import { isBodyMeasurementRecord } from "./bodyMeasurementRecords.js";

export function getMeasurementTimestampValue(measurement = {}) {
  const rawDate = measurement.date || measurement.createdAt || measurement.savedAt || "";
  let timestamp;
  if (rawDate && typeof rawDate.toMillis === "function") timestamp = rawDate.toMillis();
  else if (rawDate && typeof rawDate === "object" && Number.isFinite(rawDate.seconds ?? rawDate._seconds)) {
    timestamp = Number(rawDate.seconds ?? rawDate._seconds) * 1000 + Number(rawDate.nanoseconds ?? rawDate._nanoseconds ?? 0) / 1000000;
  } else timestamp = rawDate ? new Date(rawDate).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function selectLatestMeasurementSnapshot(measurements = []) {
  const sorted = [...(Array.isArray(measurements) ? measurements : [])]
    .sort((a, b) => getMeasurementTimestampValue(b) - getMeasurementTimestampValue(a));
  return {
    latestWeight: sorted.find(item => Number(String(item?.weight ?? item?.values?.weight ?? "").replace(",", ".")) > 0) || null,
    latestBody: sorted.find(isBodyMeasurementRecord) || null,
    recent7: sorted.slice(0, 7)
  };
}
