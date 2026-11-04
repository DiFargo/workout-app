import { getMeasurementTimestampValue } from "../../functions/measurementSnapshot.js";

function readPositiveWeight(record) {
  for (const raw of [record?.weight, record?.values?.weight]) {
    if (raw === null || raw === undefined || String(raw).trim() === "") continue;
    const value = Number(String(raw).replace(",", "."));
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function measurementTimestamp(record) {
  const raw = record.date || record.createdAt || record.updatedAt || record.savedAt || "";
  try {
    return getMeasurementTimestampValue({
      date: raw && typeof raw.toDate === "function" ? raw.toDate() : raw
    });
  } catch {
    return 0;
  }
}

// Keep the actual saved record and its own date; do not synthesize a body
// measurement from the profile or borrow the latest body measurement's date.
export function getLatestTrainerWeightMeasurement(measurements = []) {
  let latest = null;
  let latestTimestamp = -Infinity;
  for (const record of Array.isArray(measurements) ? measurements : []) {
    if (!record || typeof record !== "object" || readPositiveWeight(record) === null) continue;
    const timestamp = measurementTimestamp(record);
    if (timestamp > latestTimestamp) {
      latest = record;
      latestTimestamp = timestamp;
    }
  }
  return latest;
}

function photoTimestamp(value) {
  if (value === null || value === undefined || value === "") return null;
  try {
    let timestamp;
    if (typeof value?.toMillis === "function") timestamp = value.toMillis();
    else if (typeof value?.toDate === "function") timestamp = value.toDate().getTime();
    else if (typeof value === "object" && Number.isFinite(value.seconds ?? value._seconds)) {
      timestamp = Number(value.seconds ?? value._seconds) * 1000
        + Number(value.nanoseconds ?? value._nanoseconds ?? 0) / 1e6;
    } else {
      const date = value instanceof Date ? value : new Date(value);
      timestamp = date.getTime();
      // Date-only values are session dates, not permissive overflow dates.
      if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value)
        && Number.isFinite(timestamp) && date.toISOString().slice(0, 10) !== value) return null;
    }
    return Number.isFinite(timestamp) ? timestamp : null;
  } catch {
    return null;
  }
}

export function getTrainerProgressPhotoId(photo, index) {
  const source = photo.id || photo.createdAt || photo.date;
  if (source && typeof source !== "object") return String(source);
  // Firestore Timestamp/Date objects stringify to ambiguous identities. Use
  // their actual time instead; string dates retain ClientPhotos' existing IDs.
  const sourceTimestamp = photoTimestamp(source);
  if (source && sourceTimestamp !== null) return `photo-${sourceTimestamp}`;
  return `photo-${index}`;
}

/**
 * Return one real photo or a strictly chronological pair, never the same
 * session twice. `options` contains only dated sessions, oldest first.
 * Unknown dates stay available to the caller's full gallery, not a false
 * before/after comparison. The caller must use neutral labels for one photo.
 */
export function getTrainerPhotoCompareSelection(photos = [], requestedIds = ["", ""], changedIndex = null) {
  const seenIds = new Set();
  const entries = (Array.isArray(photos) ? photos : []).flatMap((photo, index) => {
    if (!photo || typeof photo !== "object") return [];
    const timestamp = photoTimestamp(photo.date || photo.createdAt);
    const id = getTrainerProgressPhotoId(photo, index);
    if (seenIds.has(id)) return [];
    seenIds.add(id);
    return [{ id, photo, timestamp, index }];
  });
  const options = entries.filter(entry => entry.timestamp !== null)
    .sort((left, right) => left.timestamp - right.timestamp || left.index - right.index)
    .map(entry => ({ id: entry.id, photo: entry.photo, date: new Date(entry.timestamp) }));
  const dated = options.map(option => ({ ...option, timestamp: option.date.getTime() }));
  const requested = Array.isArray(requestedIds) ? requestedIds.map(id => String(id ?? "")) : ["", ""];
  const beforeRequest = dated.find(entry => entry.id === requested[0]);
  const afterRequest = dated.find(entry => entry.id === requested[1]);
  const earlier = target => dated.findLast(entry => entry.timestamp < target.timestamp);
  const later = target => dated.find(entry => entry.timestamp > target.timestamp);
  const result = selected => ({
    ids: selected.map(entry => entry.id),
    photos: selected.map(entry => entry.photo),
    options,
    hasChronologicalPair: selected.length === 2
  });
  const orderedPair = (first, second) => first && second && first.timestamp !== second.timestamp
    ? result(first.timestamp < second.timestamp ? [first, second] : [second, first])
    : null;

  if (changedIndex === 0 && beforeRequest) {
    const next = afterRequest?.timestamp > beforeRequest.timestamp ? afterRequest : later(beforeRequest);
    return orderedPair(beforeRequest, next) || orderedPair(earlier(beforeRequest), beforeRequest) || result([beforeRequest]);
  }
  if (changedIndex === 1 && afterRequest) {
    const previous = beforeRequest?.timestamp < afterRequest.timestamp ? beforeRequest : earlier(afterRequest);
    return orderedPair(previous, afterRequest) || orderedPair(afterRequest, later(afterRequest)) || result([afterRequest]);
  }
  const requestedPair = orderedPair(beforeRequest, afterRequest);
  if (requestedPair) return requestedPair;
  if (beforeRequest) {
    return orderedPair(beforeRequest, later(beforeRequest))
      || orderedPair(earlier(beforeRequest), beforeRequest)
      || result([beforeRequest]);
  }
  if (afterRequest) {
    return orderedPair(earlier(afterRequest), afterRequest)
      || orderedPair(afterRequest, later(afterRequest))
      || result([afterRequest]);
  }
  const newest = dated.at(-1);
  if (newest) return orderedPair(earlier(newest), newest) || result([newest]);
  const fallback = entries.find(entry => entry.id === requested[changedIndex === 1 ? 1 : 0])
    || entries.find(entry => requested.includes(entry.id)) || entries[0];
  return result(fallback ? [fallback] : []);
}
