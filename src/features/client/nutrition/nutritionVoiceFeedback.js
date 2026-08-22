const VOICE_SEARCH_FAILURE_PATTERN = /(?:^|\s)(?:не удалось|не нашли|ничего не|ии сейчас|нет подключения|голосовой ввод не поддерживается|запись получилась слишком|запись слишком длинная)/iu;

export function isNutritionVoiceSearchFailure(value) {
  return VOICE_SEARCH_FAILURE_PATTERN.test(String(value || "").trim());
}
