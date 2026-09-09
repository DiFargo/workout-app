// Normalization refreshes these timestamps even when the program was only viewed.
export function getTrainerProgramEditorSnapshot(program) {
  if (!program) return "null";
  const { createdAt, updatedAt, ...content } = program;
  return JSON.stringify(content);
}
