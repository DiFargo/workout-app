const MAX_VOICE_TRANSCRIPT_LENGTH = 700;

// Do not use \b here: JavaScript word boundaries only recognise ASCII word
// characters, so they do not reliably detect the start of a Russian word.
const INEDIBLE_QUALITY_PATTERN = /(?:^|[^\p{L}])(?:гнил\p{L}*|сгнив\p{L}*|протух\p{L}*|испорчен\p{L}*|плеснев\p{L}*)\s+([\p{L}-]{3,})(?=$|[^\p{L}])/giu;
const IMPOSSIBLE_MATERIAL_PATTERN = /(?:^|[^\p{L}])(?:камен\p{L}*|железн\p{L}*|бетон\p{L}*|стеклян\p{L}*|резинов\p{L}*|пластиков\p{L}*|деревян\p{L}*|бумажн\p{L}*|мыльн\p{L}*)\s+([\p{L}-]{3,})(?=$|[^\p{L}])/giu;

function normalizeVoiceSafetyText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_VOICE_TRANSCRIPT_LENGTH)
    .toLowerCase();
}

function getVoiceFoodWordStem(value) {
  const word = String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}]/giu, "");
  return word.length >= 4 ? word.slice(0, 4) : word;
}

export function getUnsafeVoiceFoodStems(value) {
  const transcript = normalizeVoiceSafetyText(value);
  const unsafeStems = new Set();

  [INEDIBLE_QUALITY_PATTERN, IMPOSSIBLE_MATERIAL_PATTERN].forEach((pattern) => {
    pattern.lastIndex = 0;
    let match = pattern.exec(transcript);
    while (match) {
      const foodWord = String(match[1] || "").toLowerCase();
      // "Каменная соль" is a real culinary ingredient, not an impossible food.
      if (!/^сол[ьи]?$/u.test(foodWord)) {
        const stem = getVoiceFoodWordStem(foodWord);
        if (stem) unsafeStems.add(stem);
      }
      match = pattern.exec(transcript);
    }
  });

  return unsafeStems;
}

export function isUnsafeVoiceFoodQuery(query, unsafeFoodStems = new Set()) {
  const queryStems = normalizeVoiceSafetyText(query)
    .split(/[^\p{L}-]+/iu)
    .map(getVoiceFoodWordStem)
    .filter(Boolean);
  if (!queryStems.length) return true;

  if (getUnsafeVoiceFoodStems(query).size) return true;

  return queryStems.some((queryStem) => [...unsafeFoodStems].some((unsafeStem) => (
    queryStem === unsafeStem || queryStem.startsWith(unsafeStem) || unsafeStem.startsWith(queryStem)
  )));
}
