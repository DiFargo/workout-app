const MAX_VOICE_FOOD_AMOUNT = 2000;
const VOICE_NUMERIC_METRIC_AMOUNT_PATTERN = /(?:^|[^\p{L}\p{N}])(\d+(?:[.,]\d+)?)\s*(г|гр\.?|грамм(?:а|ов)?|мл|миллилитр(?:а|ов)?|л|литр(?:а|ов)?|g|gr\.?|ml|l)(?=$|[^\p{L}])/giu;

function normalizeVoiceMetricAmount(value, unit = "") {
  const numericValue = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;

  const normalizedUnit = String(unit || "").trim().toLowerCase();
  const millilitres = normalizedUnit === "л" || normalizedUnit === "l" || normalizedUnit.startsWith("литр")
    ? numericValue * 1000
    : numericValue;

  return Math.max(1, Math.min(MAX_VOICE_FOOD_AMOUNT, Math.round(millilitres)));
}

/**
 * Returns numeric metric amounts explicitly present in the speaker's phrase.
 * The diary currently calculates millilitres on the same numeric scale as grams.
 */
export function extractVoiceMetricAmounts(transcript) {
  const normalizedTranscript = String(transcript || "")
    .normalize("NFKC")
    .toLowerCase();

  return Array.from(normalizedTranscript.matchAll(VOICE_NUMERIC_METRIC_AMOUNT_PATTERN))
    .map((match) => normalizeVoiceMetricAmount(match[1], match[2]))
    .filter((amount) => amount !== null);
}

function normalizeModelVoiceAmount(value) {
  return normalizeVoiceMetricAmount(value);
}

function getMatchedVoiceMetricAmount(items, itemIndex, metricAmounts, modelAmount) {
  if (!metricAmounts.length) return null;

  if (items.length === 1 && metricAmounts.length === 1) {
    return metricAmounts[0];
  }

  if (items.length === metricAmounts.length) {
    return metricAmounts[itemIndex] ?? null;
  }

  const matchingAmounts = metricAmounts.filter((amount) => amount === modelAmount);
  return matchingAmounts.length === 1 ? matchingAmounts[0] : null;
}

/**
 * Keeps only amounts that can be tied to a spoken numeric amount. This prevents
 * a model-default "100 g" from replacing a stated amount such as "500 ml".
 */
export function resolveVoiceFoodMetricAmounts(items, {
  metricAmounts = [],
  hasSpokenMetricAmount = false
} = {}) {
  const safeItems = Array.isArray(items) ? items : [];
  const safeMetricAmounts = (Array.isArray(metricAmounts) ? metricAmounts : [])
    .map((amount) => normalizeVoiceMetricAmount(amount))
    .filter((amount) => amount !== null);

  return safeItems.map((item, itemIndex) => {
    const modelAmount = normalizeModelVoiceAmount(item?.grams);
    const spokenAmount = getMatchedVoiceMetricAmount(
      safeItems,
      itemIndex,
      safeMetricAmounts,
      modelAmount
    );
    const hasExplicitAmount = spokenAmount !== null || (
      safeMetricAmounts.length === 0 &&
      hasSpokenMetricAmount &&
      modelAmount !== null &&
      !item?.amountEstimated
    );

    return {
      grams: hasExplicitAmount ? (spokenAmount ?? modelAmount) : 0,
      amountEstimated: !hasExplicitAmount
    };
  });
}
