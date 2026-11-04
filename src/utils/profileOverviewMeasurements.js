import { getMeasurementTimestampValue } from "../../functions/measurementSnapshot.js";

// Only for latest-value cards and their short graph, never a history contract.
// Keep actual records (including their IDs and body fields), not synthetic rows.
export function getProfileOverviewMeasurements(snapshot, fullHistory = []) {
  const metadata = snapshot?.kind === "measurements" && snapshot.coverage?.measurements === "complete"
    ? snapshot.measurements : null;
  const records = [...(Array.isArray(fullHistory) ? fullHistory : []),
    ...(Array.isArray(metadata?.recent7) ? metadata.recent7 : []), metadata?.latestBody, metadata?.latestWeight]
    .filter(record => record && typeof record === "object");
  const byIdentity = new Map();
  for (const record of records) {
    const identity = record.id || record.clientSaveId || record;
    byIdentity.set(identity, record);
  }
  return [...byIdentity.values()].sort((a, b) => getMeasurementTimestampValue(b) - getMeasurementTimestampValue(a));
}
