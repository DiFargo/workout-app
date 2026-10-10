// Normalization refreshes these timestamps even when the program was only viewed.
export function getTrainerProgramEditorSnapshot(program) {
  if (!program) return "null";
  const content = { ...program };
  delete content.createdAt;
  delete content.updatedAt;
  return JSON.stringify(content);
}
