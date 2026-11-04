export const EMPTY_TRAINER_LIBRARY_ITEMS = Object.freeze([]);

const IDLE_LIBRARY_STATE = Object.freeze({
  templates: "idle",
  cards: "idle",
  templatesKnown: false,
  cardsKnown: false
});
const SOURCE_STATES = new Set(["idle", "loading", "ready", "error"]);
const sourceState = value => SOURCE_STATES.has(value) ? value : "idle";

// A UID alone does not distinguish a new login of the same account. The
// captured auth-session identity also invalidates state from that old login.
export function getCurrentTrainerLibraryLoadState(record) {
  if (typeof record?.session?.isCurrent !== "function" || !record.session.isCurrent()) {
    return IDLE_LIBRARY_STATE;
  }
  const templates = sourceState(record.templates);
  const cards = sourceState(record.cards);
  return {
    templates,
    cards,
    templatesKnown: templates !== "idle" && record.templatesKnown === true,
    cardsKnown: cards !== "idle" && record.cardsKnown === true
  };
}

export function getTrainerLibraryViewState(state, kind = "templates") {
  // Older callers and isolated fixtures did not have a loading contract. An
  // explicitly supplied idle/null state, however, is never a confirmed empty.
  if (state === undefined) return { complete: true, loading: false, error: false };
  const sources = kind === "exercises"
    ? [sourceState(state?.templates), sourceState(state?.cards)]
    : [sourceState(state?.templates)];
  const complete = sources.every(value => value === "ready");
  const error = sources.includes("error");
  return { complete, loading: !complete && !error, error };
}
