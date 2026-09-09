import { doc, runTransaction } from "firebase/firestore";

export async function persistMeasurement({ db, uid, item, completeFirstSetupVersion = "" }) {
  const userRef = doc(db, "users", uid);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(userRef);
    const user = snapshot.data() || {};
    const recordedAt = item.measurement.date || item.measurement.createdAt;
    const previousAt = user.measurementWeightUpdatedAt || user.aiNutritionProfile?.updatedAt || user.updatedAt;
    const newerWeight = item.profileWeight && (!previousAt || Date.parse(recordedAt) >= Date.parse(previousAt));
    transaction.set(doc(db, "users", uid, "measurements", item.id), item.measurement);
    if (newerWeight || completeFirstSetupVersion) transaction.set(userRef, {
      ...(newerWeight ? {
        aiNutritionProfile: { ...item.aiNutritionProfile, ...user.aiNutritionProfile, weight: item.profileWeight },
        measurementWeightUpdatedAt: recordedAt
      } : {}),
      ...(completeFirstSetupVersion ? {
        firstSetupCompleted: true,
        firstSetupCompletedVersion: completeFirstSetupVersion,
        firstSetupCompletedAt: new Date().toISOString()
      } : {})
    }, { merge: true });
    return { weightUpdated: Boolean(newerWeight) };
  });
}
