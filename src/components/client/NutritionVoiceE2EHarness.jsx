import { useState } from "react";
import NutritionVoiceModal from "../../features/client/nutrition/NutritionVoiceModal";
import { buildUpdatedNutritionVoiceItem } from "../../features/client/nutrition/nutritionVoiceItemEditor.js";

export default function NutritionVoiceE2EHarness({ longList = false }) {
  const [open, setOpen] = useState(true);
  const [voiceState, setVoiceState] = useState("idle");
  const [result, setResult] = useState("");
  const [items, setItems] = useState(() => [
    ...Array.from({ length: longList ? 12 : 1 }, (_, index) => ({
      id: `tomato-${index}`, name: "Овощи и продукты из них: Томаты свежие с зеленью", mealId: "lunch",
      amount: 400, calories: 72, protein: 3.5, fat: 0.8, carbs: 15.6
    })),
    { id: "tuna-choice", kind: "candidate", query: "тунец", mealId: "lunch", candidates: [
      { id: "tuna-water", name: "Тунец в собственном соку, консервированный", calories: 92 },
      { id: "tuna-oil", name: "Тунец в растительном масле, консервированный", calories: 198 }
    ] }
  ]);

  return <>
    <output data-testid="voice-harness-result">{result}</output>
    <NutritionVoiceModal
      open={open}
      voiceState={voiceState}
      voiceAddedItems={items}
      onClose={() => setOpen(false)}
      onVoiceStart={() => setVoiceState("recording")}
      onVoiceEnd={() => setVoiceState("idle")}
      onVoiceDone={({ commit }) => setResult(commit ? `saved:${items.length}` : "cancelled")}
      onVoiceAddedItemRemove={(id, candidateId) => setItems(current => current.flatMap(item => {
        if (item.id !== id) return [item];
        const candidate = item.candidates?.find(option => option.id === candidateId);
        return candidate ? [{ ...candidate, mealId: item.mealId, amount: 100, protein: 20, fat: 1, carbs: 0 }] : [];
      }))}
      onVoiceAddedItemUpdate={(id, draft) => {
        const next = buildUpdatedNutritionVoiceItem(items.find(item => item.id === id), draft);
        if (!next) return false;
        setItems(current => current.map(item => item.id === id ? next : item));
        return true;
      }}
    />
  </>;
}
