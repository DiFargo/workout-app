// Central limits for client-list fan-out. Keep these independent from Firebase
// adapters so they can be checked in lightweight quality tests as well.
export const MAX_TRAINER_SUMMARY_CONCURRENCY = 4;
export const MAX_TRAINER_LINKED_PROFILE_CONCURRENCY = 6;

export async function mapWithConcurrency(items = [], concurrency, callback) {
  const source = Array.isArray(items) ? items : [];
  const limit = Math.max(1, Math.min(Number(concurrency) || 1, source.length || 1));
  const results = new Array(source.length);
  let nextIndex = 0;

  await Promise.all(Array.from({ length: limit }, async () => {
    while (nextIndex < source.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = { status: "fulfilled", value: await callback(source[index], index) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }));

  return results;
}
