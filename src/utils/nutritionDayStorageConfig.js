let enabled = false;
export const configureNutritionDayStorage = ({ enabled: value = true } = {}) => { enabled = value === true; };
export const isNutritionDayStorageEnabled = () => enabled;
// Merging a fresh cloud state into an old durable outbox must not silently
// grant that outbox the new writer epoch. Only explicit rebase may do so.
export function withNutritionPendingScope(snapshot, pending) {
  return enabled && pending ? { ...snapshot, __nutritionStorage: pending.__nutritionStorage || { generation: "legacy", writerEpoch: 0 } } : snapshot;
}
