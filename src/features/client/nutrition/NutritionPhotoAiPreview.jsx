import {
  getFoodIcon,
  getShortFoodName
} from "../../../utils/nutritionFoodPresentation";

export default function NutritionPhotoAiPreview({
  preview,
  analyzing,
  confidence,
  result,
  selectedFood,
  candidates,
  onSelectCandidate,
  onReset
}) {
  if (!preview) {
    return null;
  }

  return (
    <div className={`fatPhotoAiFloatingPreview ${analyzing ? "isAnalyzing" : ""}`}>
      <div className="fatPhotoAiPreviewImage">
        <img src={preview} alt="Фото продукта" />
        {analyzing && <span className="fatPhotoAiScanLine" aria-hidden="true" />}
      </div>

      <div className="fatPhotoAiPreviewText">
        <div className="fatPhotoAiPreviewTop">
          <strong>{analyzing ? "Анализирую фото" : "Распознано"}</strong>
          {confidence && <em>{confidence}</em>}
        </div>

        <span>
          {analyzing
            ? "Анализирую фото и создаю продукт"
            : selectedFood?.name || result?.replace(/^ИИ распознал:\s*/i, "").replace(/^Ниже показаны варианты из базы\.?$/i, "") || "Выбери вариант из списка"}
        </span>

        {candidates.length > 1 && !analyzing && (
          <div className="fatPhotoAiCandidates">
            {candidates.slice(0, 3).map((candidate) => (
              <button
                type="button"
                key={`${candidate.id}-${candidate.name}`}
                onClick={() => onSelectCandidate(candidate)}
              >
                <span>{candidate.icon || getFoodIcon(candidate)}</span>
                <strong>{getShortFoodName(candidate.name)}</strong>
              </button>
            ))}
          </div>
        )}

        {analyzing && (
          <div className="fatPhotoAiAnalyzeDots" aria-hidden="true">
            <i /><i /><i />
          </div>
        )}
      </div>

      <button type="button" className="fatPhotoAiClear" onClick={onReset} aria-label="Убрать фото">×</button>
    </div>
  );
}
