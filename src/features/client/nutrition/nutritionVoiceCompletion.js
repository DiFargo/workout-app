export function getUnresolvedVoiceCandidates(items = []) {
  return items.filter(item => item?.kind === "candidate" && Array.isArray(item.candidates) && item.candidates.length > 0);
}

export function hasUncommittedVoiceItems(items = []) {
  return getUnresolvedVoiceCandidates(items).length > 0 || items.some(item => item?.kind === "review" || item?.requiresReview === true);
}
