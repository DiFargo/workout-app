import {
  getFoodIcon,
  getShortFoodName
} from "../../../utils/nutritionFoodPresentation";
import styles from "./NutritionPhotoAiPreview.module.css";

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
    <div
      className={`${styles.root} ${analyzing ? styles.analyzing : ""}`}
      data-css-module-scope="nutrition-photo-ai-preview"
      data-testid="nutrition-photo-ai-preview"
      data-state={analyzing ? "analyzing" : "result"}
      aria-live="polite"
    >
      <div className={styles.image}>
        <img src={preview} alt="Фото продукта" />
        {analyzing && <span className={styles.scanLine} aria-hidden="true" />}
      </div>

      <div className={styles.content}>
        <div className={styles.heading}>
          <strong data-css-module-text>{analyzing ? "Анализирую фото" : "Распознано"}</strong>
          {confidence && <em className={styles.confidence}>{confidence}</em>}
        </div>

        <span className={styles.description} data-css-module-text>
          {analyzing
            ? "Анализирую фото и создаю продукт"
            : selectedFood?.name || result?.replace(/^ИИ распознал:\s*/i, "").replace(/^Ниже показаны варианты из базы\.?$/i, "") || "Выбери вариант из списка"}
        </span>

        {candidates.length > 1 && !analyzing && (
          <div className={styles.candidates} data-testid="nutrition-photo-ai-candidates">
            {candidates.slice(0, 3).map((candidate) => (
              <button
                type="button"
                key={`${candidate.id}-${candidate.name}`}
                className={styles.candidate}
                data-css-module-control
                data-photo-ai-candidate={candidate.id}
                onClick={() => onSelectCandidate(candidate)}
              >
                <span className={styles.candidateIcon} aria-hidden="true">
                  {candidate.icon || getFoodIcon(candidate)}
                </span>
                <strong data-css-module-text>{getShortFoodName(candidate.name)}</strong>
              </button>
            ))}
          </div>
        )}

        {analyzing && (
          <div className={styles.dots} data-testid="nutrition-photo-ai-dots" aria-hidden="true">
            <i /><i /><i />
          </div>
        )}
      </div>

      <button
        type="button"
        className={styles.resetButton}
        data-css-module-control
        data-photo-ai-action="reset"
        onClick={onReset}
        aria-label="Убрать фото"
      >
        ×
      </button>
    </div>
  );
}
