export const VIDEO_ACCESS_REFRESH_MARGIN_MS = 60_000;
export const protectedExerciseVideoAccess = {
  subscribe: () => () => {},
  getSnapshot: () => 0,
  isProtected: source => /^(?:gs:|https?:|\/\/)/.test(String(source || "")),
  resolve: async () => { throw new Error("Закрытые видео доступны в отдельном staging-окружении."); },
  getCachedPoster: () => null,
  prefetchPoster: async () => null,
  invalidate() {}
};
