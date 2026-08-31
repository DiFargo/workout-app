import { LoaderCircle, Mic, RefreshCw, Trash2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { isNutritionVoiceSearchFailure } from "./nutritionVoiceFeedback";
import { getNutritionVoiceItemEditDraft } from "./nutritionVoiceItemEditor";
import styles from "./NutritionVoiceModal.module.css";

function getVoiceCopy({ analyzing, recording, feedback, hasAddedItems, hasReviewItems, hasSearchFailure }) {
  if (analyzing) {
    return {
      eyebrow: "Голосовой ввод · тест",
      title: "Идёт поиск продуктов",
      description: "Ищем продукты в проверенной базе и уточняем порции.",
      holdLabel: "Идёт поиск…"
    };
  }

  if (recording) {
    return {
      eyebrow: "Голосовой ввод · тест",
      title: "Слушаем вас",
      description: "Назовите продукты с количеством, затем нажмите кнопку ещё раз.",
      holdLabel: "Нажмите, чтобы закончить"
    };
  }

  if (hasReviewItems) {
    return {
      eyebrow: "Голосовой ввод · проверка",
      title: "Проверьте перед добавлением",
      description: "Для этих позиций ИИ дал примерную оценку. Уточните КБЖУ и порцию перед добавлением в дневник.",
      holdLabel: "Добавить ещё"
    };
  }

  if (hasSearchFailure) {
    return {
      eyebrow: "Голосовой ввод · поиск не удался",
      title: "Не удалось найти продукты",
      description: feedback || "Повторите запись и назовите продукты чуть отчётливее.",
      holdLabel: "Повторить запись"
    };
  }

  return {
    eyebrow: "Голосовой ввод · тест",
    title: hasAddedItems ? "Готово" : "Что вы съели?",
    description: hasAddedItems
      ? "Проверьте добавленные продукты. Ошибочную позицию можно удалить."
      : (feedback.startsWith("Добавлено") ? "Нажмите микрофон и скажите, что съели." : feedback || "Нажмите микрофон и скажите, что съели. Например: «на обед 200 граммов курицы и рис»."),
    holdLabel: hasAddedItems ? "Добавить ещё" : "Нажмите, чтобы начать"
  };
}

function getVoiceMealName(mealId) {
  const labels = {
    breakfast: "Завтрак",
    lunch: "Обед",
    dinner: "Ужин",
    snack: "Перекус"
  };
  return labels[mealId] || "Приём пищи";
}

function formatCandidateCalories(calories) {
  const value = Number(calories);
  if (!Number.isFinite(value)) return "";

  return `${Math.round(value)} ккал на 100 г`;
}

function formatVoiceNumber(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "0";
  return Number.isInteger(numericValue) ? String(numericValue) : numericValue.toFixed(1).replace(/\.0$/, "");
}

function formatVoiceAddedFoodAmount(item) {
  const amount = formatVoiceNumber(item?.amount);
  if (item?.amountMode === "portion") return `${amount} ${item?.portion || "порц."}`;
  return `${amount} г`;
}

function formatVoiceAddedFoodMacros(item) {
  return `${formatVoiceNumber(item?.calories)} ккал · Б ${formatVoiceNumber(item?.protein)} · Ж ${formatVoiceNumber(item?.fat)} · У ${formatVoiceNumber(item?.carbs)}`;
}

export default function NutritionVoiceModal({
  open,
  origin = null,
  voiceState = "idle",
  feedback = "",
  audioLevel = 0,
  voiceCandidates = [],
  voiceAddedItems = [],
  onClose,
  onVoiceStart,
  onVoiceEnd,
  onVoiceCandidateSelect,
  onVoiceAddedItemRemove,
  onVoiceAddedItemUpdate,
  onVoiceDone
}) {
  const [editingItemId, setEditingItemId] = useState("");
  const [editingDraft, setEditingDraft] = useState(null);
  const [editingError, setEditingError] = useState("");
  const isRecording = voiceState === "recording";
  const isAnalyzing = voiceState === "analyzing";
  const normalizedAudioLevel = Math.min(1, Math.max(0, Number(audioLevel) || 0));
  const voiceResultItems = voiceState === "idle" && Array.isArray(voiceAddedItems)
    ? voiceAddedItems
    : [];
  const pendingVoiceCandidates = voiceState === "idle"
    ? [
        ...(Array.isArray(voiceCandidates) ? voiceCandidates : []),
        ...voiceResultItems.filter((item) => item?.kind === "candidate")
      ].filter((item) => Array.isArray(item?.candidates) && item.candidates.length > 0)
    : [];
  const addedVoiceItems = voiceResultItems
    .filter((item) => item?.id && item?.name && item?.kind !== "candidate");
  const reviewVoiceItems = addedVoiceItems.filter((item) => item?.kind === "review" || item?.requiresReview === true);
  const hasReviewItems = reviewVoiceItems.length > 0;
  const hasAddedItems = addedVoiceItems.length > 0;
  const editingItem = addedVoiceItems.find((item) => item.id === editingItemId) || null;
  const hasSearchFailure = !isRecording && !isAnalyzing && !hasAddedItems && !pendingVoiceCandidates.length && isNutritionVoiceSearchFailure(feedback);
  const hasOrigin = [origin?.top, origin?.left, origin?.width, origin?.height].every(Number.isFinite);
  const useAnchoredCaptureSurface = hasOrigin && !hasAddedItems && pendingVoiceCandidates.length === 0 && !hasSearchFailure;
  const originStyle = hasOrigin
    ? {
        "--voice-origin-top": `${origin.top}px`,
        "--voice-origin-left": `${origin.left}px`,
        "--voice-origin-center": `${origin.left + origin.width / 2}px`,
        "--voice-origin-width": `${origin.width}px`,
        "--voice-origin-height": `${origin.height}px`
      }
    : {};
  const audioWaveStyle = {
    "--voice-wave-inner-scale": (1 + normalizedAudioLevel * 0.1).toFixed(3),
    "--voice-wave-outer-scale": (1 + normalizedAudioLevel * 0.14).toFixed(3),
    "--voice-wave-inner-opacity": (0.24 + normalizedAudioLevel * 0.58).toFixed(3),
    "--voice-wave-outer-opacity": (0.16 + normalizedAudioLevel * 0.46).toFixed(3)
  };
  const copy = getVoiceCopy({
    analyzing: isAnalyzing,
    recording: isRecording,
    feedback,
    hasAddedItems,
    hasReviewItems,
    hasSearchFailure
  });

  const cancelAndClose = () => {
    onVoiceEnd?.({ cancelled: true });
    if (hasAddedItems || pendingVoiceCandidates.length > 0) onVoiceDone?.({ commit: false });
    onClose?.();
  };

  const finishAndClose = () => {
    onVoiceEnd?.({ cancelled: true });
    onVoiceDone?.({ commit: true });
    onClose?.();
  };

  const openItemEditor = (item) => {
    setEditingItemId(item.id);
    setEditingDraft(getNutritionVoiceItemEditDraft(item));
    setEditingError("");
  };

  const closeItemEditor = () => {
    setEditingItemId("");
    setEditingDraft(null);
    setEditingError("");
  };

  const updateEditingDraft = (field, value) => {
    setEditingDraft((draft) => ({ ...draft, [field]: value }));
  };

  const saveItemEditor = () => {
    if (!editingItem || !editingDraft) return;
    const saved = onVoiceAddedItemUpdate?.(editingItem.id, editingDraft);
    if (!saved) {
      setEditingError("Укажите название и порцию от 1 до 2 000 г.");
      return;
    }
    closeItemEditor();
  };

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onVoiceEnd?.({ cancelled: true });
      onClose?.();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, onVoiceEnd]);

  useEffect(() => {
    if (editingItemId && !editingItem) closeItemEditor();
  }, [editingItem, editingItemId]);

  function toggleCapture() {
    if (isAnalyzing) return;
    if (isRecording) {
      onVoiceEnd?.();
      return;
    }
    onVoiceStart?.();
  }

  function retryVoiceSearch() {
    if (isAnalyzing || isRecording) return;
    onVoiceStart?.();
  }

  function renderRecordControl(anchored = false) {
    return (
      <div
        className={`${styles.recordVisual}${isRecording ? ` ${styles.recordVisualActive}` : ""}${hasAddedItems ? ` ${styles.recordVisualResult}` : ""}${hasSearchFailure ? ` ${styles.recordVisualFailed}` : ""}${anchored ? ` ${styles.anchoredRecordVisual}` : ""}`}
        style={anchored ? { ...audioWaveStyle, ...originStyle } : audioWaveStyle}
      >
        <span className={styles.audioWave} aria-hidden="true">
          <span className={`${styles.audioWaveLine} ${styles.audioWaveLineInner}`} />
          <span className={`${styles.audioWaveLine} ${styles.audioWaveLineOuter}`} />
        </span>

        <button
          type="button"
          className={`${styles.recordButton}${isRecording ? ` ${styles.recording}` : ""}${isAnalyzing ? ` ${styles.analyzing}` : ""}${hasAddedItems ? ` ${styles.recordButtonResult}` : ""}${hasSearchFailure ? ` ${styles.recordButtonFailed}` : ""}${anchored ? ` ${styles.anchoredRecordButton}` : ""}`}
          data-testid="nutrition-voice-record"
          data-nutrition-voice-state={voiceState}
          onClick={toggleCapture}
          disabled={isAnalyzing}
          aria-label={isAnalyzing
            ? "Идёт поиск продуктов по голосовой записи"
            : hasSearchFailure
              ? "Повторить голосовой поиск"
            : isRecording
              ? "Нажмите, чтобы закончить запись"
              : "Нажмите, чтобы начать запись"}
        >
          <span className={styles.recordIcon} aria-hidden="true">
            {isAnalyzing ? <LoaderCircle className={styles.spinner} /> : hasSearchFailure ? <RefreshCw /> : <Mic />}
          </span>
          <span className={styles.recordLabel}>{copy.holdLabel}</span>
        </button>
      </div>
    );
  }

  if (!open) return null;

  return createPortal(
    <div
      className={styles.overlay}
      data-testid="nutrition-voice-modal"
      data-css-module-scope="nutrition-voice-modal"
      role="dialog"
      aria-modal="true"
      aria-label={useAnchoredCaptureSurface ? "Голосовой ввод" : undefined}
      aria-labelledby={useAnchoredCaptureSurface ? undefined : "nutritionVoiceModalTitle"}
      aria-describedby={useAnchoredCaptureSurface ? undefined : "nutritionVoiceModalDescription"}
      data-modal-surface="true"
    >
      <button
        type="button"
        className={styles.backdrop}
        data-testid="nutrition-voice-backdrop"
        onClick={cancelAndClose}
        aria-label="Отменить голосовой ввод"
      />

      {useAnchoredCaptureSurface ? (
        <section className={styles.anchoredSurface} data-testid="nutrition-voice-sheet" style={originStyle}>
          <button
            type="button"
            className={`${styles.closeButton} ${styles.anchoredCloseButton}`}
            data-testid="nutrition-voice-close"
            onClick={cancelAndClose}
            aria-label="Закрыть голосовой ввод"
          >
            <X aria-hidden="true" />
          </button>
          {renderRecordControl(true)}
          <p className={styles.anchoredHint} data-testid="nutrition-voice-hint" aria-live="polite">
            {isRecording
              ? "Запись идёт. Нажмите кнопку ещё раз, когда закончите. До 1 минуты."
              : isAnalyzing
                ? "Идёт поиск продуктов…"
                : "Нажмите, чтобы начать запись"}
          </p>
        </section>
      ) : (
      <section
        className={styles.sheet}
        data-testid="nutrition-voice-sheet"
        data-search-failure={hasSearchFailure}
      >
        <div className={styles.grabber} aria-hidden="true" />
        <button
          type="button"
          className={styles.closeButton}
          data-testid="nutrition-voice-close"
          onClick={cancelAndClose}
          aria-label="Закрыть голосовой ввод"
        >
          <X aria-hidden="true" />
        </button>

        <p className={styles.eyebrow}>{copy.eyebrow}</p>
        <h2 className={styles.title} id="nutritionVoiceModalTitle">{copy.title}</h2>
        <p className={styles.description} id="nutritionVoiceModalDescription">{copy.description}</p>

        {editingItem && editingDraft ? (
          <section className={styles.itemEditor} aria-label={`Редактировать ${editingItem.name}`}>
            <button type="button" className={styles.editorBackButton} onClick={closeItemEditor}>
              ← К списку
            </button>
            <p className={styles.itemEditorEyebrow}>ПРОВЕРЬТЕ КБЖУ И ПОРЦИЮ</p>
            <h3 className={styles.itemEditorTitle}>Редактировать продукт</h3>
            <label className={styles.itemEditorField}>
              <span>Название</span>
              <input
                value={editingDraft.name}
                onChange={(event) => updateEditingDraft("name", event.target.value)}
                maxLength={120}
                autoComplete="off"
              />
            </label>
            <label className={styles.itemEditorField}>
              <span>Порция, г</span>
              <input
                type="number"
                inputMode="decimal"
                min="1"
                max="2000"
                value={editingDraft.amount}
                onChange={(event) => updateEditingDraft("amount", event.target.value)}
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>
            <p className={styles.itemEditorMacroTitle}>КБЖУ на 100 г</p>
            <div className={styles.itemEditorMacroGrid}>
              {[
                ["calories", "Ккал"],
                ["protein", "Белки"],
                ["fat", "Жиры"],
                ["carbs", "Углеводы"]
              ].map(([field, label]) => (
                <label className={styles.itemEditorField} key={field}>
                  <span>{label}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="9999"
                    step="0.1"
                    value={editingDraft[field]}
                    onChange={(event) => updateEditingDraft(field, event.target.value)}
                  />
                </label>
              ))}
            </div>
            <label className={styles.itemEditorSaveToMyFoods}>
              <input
                type="checkbox"
                checked={editingDraft.saveToMyFoods === true}
                onChange={(event) => updateEditingDraft("saveToMyFoods", event.target.checked)}
              />
              <span>Добавить в мою базу</span>
            </label>
            {editingError ? <p className={styles.itemEditorError}>{editingError}</p> : null}
            <button type="button" className={styles.itemEditorSaveButton} onClick={saveItemEditor}>
              Сохранить изменения
            </button>
          </section>
        ) : hasAddedItems ? (
          <section className={styles.addedItemsSection} aria-label="Добавленные продукты">
            <p className={styles.addedItemsTitle}>{hasReviewItems ? "Проверьте перед добавлением" : "Добавлено"}</p>
            <div className={styles.addedItemsList}>
              {addedVoiceItems.map((item) => (
                <article
                  className={styles.addedItem}
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openItemEditor(item)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    openItemEditor(item);
                  }}
                  aria-label={`Редактировать ${item.name}`}
                >
                  <div className={styles.addedItemCopy}>
                    <strong>{item.name}</strong>
                    <span>{getVoiceMealName(item.mealId)} · {formatVoiceAddedFoodAmount(item)} · {formatVoiceAddedFoodMacros(item)}</span>
                    {item.sourceLabel ? <span className={styles.reviewSource}>{item.sourceLabel}</span> : null}
                  </div>
                  <button
                    type="button"
                    className={styles.removeAddedItemButton}
                    onClick={(event) => {
                      event.stopPropagation();
                      onVoiceAddedItemRemove?.(item.id);
                    }}
                    aria-label={`Удалить ${item.name}`}
                    title="Удалить"
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {!editingItem && pendingVoiceCandidates.length > 0 ? (
          <section className={styles.candidateSection} aria-label="Выбор точного продукта">
            <p className={styles.candidateSectionTitle}>Выберите точный вариант</p>

            {pendingVoiceCandidates.map((item) => (
              <div className={styles.candidateGroup} key={item.id}>
                {item.query ? <p className={styles.candidateQuery}>«{item.query}» · {getVoiceMealName(item.mealId)}</p> : null}
                <div className={styles.candidateList}>
                  {item.candidates.map((candidate) => {
                    const candidateName = candidate.displayName || candidate.name;
                    const calories = formatCandidateCalories(candidate.calories);

                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        className={styles.candidateButton}
                        data-testid="nutrition-voice-candidate"
                        onClick={() => {
                          if (item.kind === "candidate") {
                            onVoiceAddedItemRemove?.(item.id, candidate.id);
                            return;
                          }
                          onVoiceCandidateSelect?.(item.id, candidate.id);
                        }}
                        aria-label={`Выбрать точное совпадение: ${candidateName}`}
                      >
                        <span className={styles.candidateName}>{candidateName}</span>
                        <span className={styles.candidateMeta}>
                          {item.candidateSourceLabel || "Точное совпадение · проверенная база"}{calories ? ` · ${calories}` : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {!editingItem ? renderRecordControl() : null}

        {!editingItem ? <p className={styles.hint} aria-live="polite">
          {isRecording
            ? "Запись идёт. Нажмите кнопку ещё раз, когда закончите. До 1 минуты."
            : isAnalyzing
              ? "Не закрывайте окно — результат появится здесь."
              : hasAddedItems
                ? hasReviewItems
                  ? "Проверьте позиции и нажмите «Добавить в дневник». Оценки ИИ не попадут в вашу базу продуктов."
                  : "Нажмите «Готово», когда всё верно."
                : hasSearchFailure
                  ? "Ничего не добавлено. Нажмите «Повторить запись» и назовите продукт ещё раз."
                  : "Распознаём русскую речь. Названия брендов можно произносить по-английски."}
        </p> : null}

        {!editingItem ? <button
          type="button"
          className={styles.doneButton}
          data-testid="nutrition-voice-done"
          onClick={hasSearchFailure ? retryVoiceSearch : finishAndClose}
        >
          {hasSearchFailure ? "Повторить запись" : hasReviewItems ? "Добавить в дневник" : "Готово"}
        </button> : null}
      </section>
      )}
    </div>,
    document.body
  );
}
