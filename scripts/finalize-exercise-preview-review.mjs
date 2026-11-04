import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const directory = resolve("output/playwright/exercise-preview-selection-2026-10-25");
const read = name => readFile(resolve(directory, name), "utf8").then(JSON.parse);
const [first, middle, last, candidates, inventory] = await Promise.all([
  "decisions-01-07.json", "decisions-08-14.json", "decisions-15-21.json", "candidates.json", "inventory.json"
].map(read));
const decisions = { ...first, ...middle, ...last,
  V021: { choice: 2, reason: "После дополнительного просмотра: лучше видны отведённые от ног гантели и положение сидя в наклоне; исходник ограничивает ясность верхней фазы." },
  V028: { choice: 2, reason: "После дополнительного просмотра: гантель дальше от ноги, видны наклон корпуса и положение рук; отчётливой верхней фазы в исходнике нет." },
  V115: { choice: 2, reason: "Дополнительный кадр показывает обе разведённые руки и гантели при наклонённом корпусе." },
  V081: { skip: true, reason: "Видео показывает сплит-присед с двумя гантелями без скамьи и не соответствует названию «Присед с гантелью на скамью»; источник требует проверки тренером." }
};
assert.equal(Object.keys(decisions).length, candidates.length);
for (const candidate of candidates) {
  assert.ok(!candidate.error && decisions[candidate.label]);
  const decision = decisions[candidate.label];
  assert.ok(decision.reason && (decision.skip || (Number.isInteger(decision.choice) && candidate.times[decision.choice - 1] < candidate.duration)));
}
await writeFile(resolve(directory, "decisions.json"), JSON.stringify(decisions, null, 2) + "\n");
const selected = inventory.entries.filter(entry => entry.status === "needs_selection" && !decisions[candidates.find(candidate => candidate.videos.includes(entry.videoLabel))?.label]?.skip);
const summary = { reviewedGroups: candidates.length, reviewedVideoEntries: inventory.entries.filter(entry => entry.status === "needs_selection").length,
  selected: selected.length, selectedCards: selected.filter(entry => entry.type === "card").length, selectedBasic: selected.filter(entry => entry.type === "basic").length,
  selectedLegacy: selected.filter(entry => entry.type === "legacy").length, withoutVideo: inventory.entries.filter(entry => entry.status === "no_video").length,
  unsuitableSourceGroups: candidates.filter(candidate => decisions[candidate.label].skip).map(candidate => ({ label: candidate.label, names: candidate.names, reason: decisions[candidate.label].reason })),
  generatedAt: new Date().toISOString() };
await writeFile(resolve(directory, "review-summary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary));
