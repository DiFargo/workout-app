export function awaitNutritionSearchResult(promise, timeoutMs, timeoutMessage = "Nutrition search timed out") {
  let timeoutId;
  const deadline = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  return Promise.race([Promise.resolve(promise), deadline])
    .finally(() => clearTimeout(timeoutId));
}
