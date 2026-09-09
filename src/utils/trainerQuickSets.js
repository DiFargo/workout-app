export function getUniformSetValue(sets, field) {
  const values = sets.map((set) => String(set?.[field] ?? "").replace(",", ".").trim());
  return new Set(values).size > 1 ? null : values[0] || "";
}

export function resizeTrainerSets(sets, count, reserve = []) {
  if (!Number.isInteger(count) || count < 1 || count > 12) return sets;
  return Array.from({ length: count }, (_, index) => structuredClone(sets[index] || reserve[index] || { ...(sets[0] || { reps: "", weight: "" }), id: `set_${Date.now()}_${index}` }));
}
