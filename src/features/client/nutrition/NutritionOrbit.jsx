import { Camera, Flame, Mic, Plus, RefreshCw } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import styles from "./NutritionOrbit.module.css";
import NutritionVoiceModal from "./NutritionVoiceModal";
import { isNutritionVoiceSearchFailure } from "./nutritionVoiceFeedback";

function getNumericText(value) {
  const match = String(value || "").match(/[\d.,]+/);
  return match ? match[0] : "0";
}

function formatSelectedDate(dateKey, title) {
  if (!dateKey) return title === "Сегодня" ? "Сегодня" : title;
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return title;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function getVoiceButtonOrigin(target) {
  const rect = target?.getBoundingClientRect?.();
  if (!rect || !Number.isFinite(rect.top) || !Number.isFinite(rect.left)) return null;

  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height
  };
}

export default function NutritionOrbit({
  items = [],
  dateTitle,
  dateKey,
  streakText,
  onAdd,
  onPhotoSearch,
  voiceEnabled = false,
  voiceState = "idle",
  voiceAudioLevel = 0,
  voiceFeedback = "",
  voiceAddedItems = [],
  onVoiceStart,
  onVoiceEnd,
  onVoiceAddedItemRemove,
  onVoiceAddedItemUpdate,
  onVoiceDone
}) {
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [voiceButtonOrigin, setVoiceButtonOrigin] = useState(null);
  const voiceButtonRef = useRef(null);
  const voiceButtonOriginRef = useRef(null);
  const photoSearchInputRef = useRef(null);
  const calories = items[0] || {};
  const macros = [items[1], items[3], items[2]].filter(Boolean);
  const circumference = 2 * Math.PI * 64;
  const calorieProgress = Math.min(100, Math.max(0, Number(calories.progress) || 0));
  const calorieProgressRounded = Math.round(calorieProgress);
  const streakDays = Number(String(streakText || "").match(/\d+/)?.[0] || 0);
  const voiceSearchFailed = voiceEnabled
    && voiceState === "idle"
    && isNutritionVoiceSearchFailure(voiceFeedback);
  useLayoutEffect(() => {
    if (!voiceEnabled || !voiceButtonRef.current) {
      voiceButtonOriginRef.current = null;
      return undefined;
    }

    const syncVoiceButtonOrigin = () => {
      voiceButtonOriginRef.current = getVoiceButtonOrigin(voiceButtonRef.current);
    };

    syncVoiceButtonOrigin();
    const resizeObserver = new ResizeObserver(syncVoiceButtonOrigin);
    resizeObserver.observe(voiceButtonRef.current);
    window.addEventListener("resize", syncVoiceButtonOrigin);
    window.addEventListener("scroll", syncVoiceButtonOrigin, true);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", syncVoiceButtonOrigin);
      window.removeEventListener("scroll", syncVoiceButtonOrigin, true);
    };
  }, [voiceEnabled]);

  function openVoiceModalFromTarget(target) {
    setVoiceButtonOrigin(voiceButtonOriginRef.current || getVoiceButtonOrigin(target));
    setVoiceModalOpen(true);
  }

  function handleVoiceAction(event) {
    if (!voiceEnabled || voiceState === "analyzing") return;

    event.preventDefault?.();
    if (voiceState === "recording") {
      onVoiceEnd?.();
      return;
    }

    openVoiceModalFromTarget(event.currentTarget);
    onVoiceStart?.();
  }

  function closeVoiceModal() {
    setVoiceModalOpen(false);
    setVoiceButtonOrigin(null);
  }

  function openPhotoSearch() {
    photoSearchInputRef.current?.click();
  }

  return (
    <>
      <section className={styles.root} aria-label="Добавить еду" data-testid="nutrition-orbit" data-css-module-scope="nutrition-orbit">
        <div className={styles.card} data-nutrition-orbit-part="card">
        <header className={styles.header}>
          <div><h2>{dateTitle || "Сегодня"}</h2><small>{formatSelectedDate(dateKey, dateTitle)}</small></div>
          <div className={styles.headerActions}>
            <span className={styles.streak}><Flame aria-hidden="true" />{streakDays} {streakDays === 1 ? "день" : "дня"} подряд</span>
          </div>
        </header>

        <div
          className={`${styles.stage}${voiceEnabled ? ` ${styles.voiceStage}` : ""}`}
          data-nutrition-orbit-part={voiceEnabled ? "voice-layout" : "stage"}
        >
          <svg className={styles.scene} viewBox="0 0 160 160" aria-hidden="true" data-nutrition-orbit-part="scene">
            <circle className={styles.track} cx="80" cy="80" r="64" />
            <circle
              className={styles.progress}
              cx="80"
              cy="80"
              r="64"
              strokeDasharray={`${(circumference * calorieProgress) / 100} ${circumference}`}
            />
            <circle data-nutrition-orbit-halo="outer" cx="80" cy="80" r="50" opacity="0" />
            {items.map((item) => (
              <path key={item.id} data-nutrition-orbit-progress={item.id} d={item.segment?.progressPath || "M 0 0"} opacity="0" />
            ))}
          </svg>
          <div className={styles.calories}>
            <span className={styles.visuallyHidden} data-nutrition-orbit-text="label">{calories.label || "Калории"}</span>
            <strong data-nutrition-orbit-text="amount">{getNumericText(calories.amount)}</strong>
            <span data-nutrition-orbit-text="target">{calories.target || "из 0 ккал"}</span>
          </div>
          {voiceEnabled && (
            <div className={styles.voiceStats} aria-live="polite">
              <div className={styles.voiceCalories} data-nutrition-orbit-part="voice-calories">
                <span className={styles.voiceCaloriesIcon}><Flame aria-hidden="true" /></span>
                <strong>{getNumericText(calories.amount)}</strong>
                <span>{calories.target || "из 0 ккал"}</span>
                <span className={styles.voiceCaloriesBar} aria-hidden="true"><span style={{ width: `${calorieProgressRounded}%` }} /></span>
                <small>{calorieProgressRounded}% от нормы</small>
              </div>
            </div>
          )}
          <button
            type="button"
            className={`${styles.hitButton}${voiceEnabled ? ` ${styles.voiceButton}` : ""}`}
            ref={voiceButtonRef}
            onClick={onAdd}
            aria-label={voiceEnabled ? "Добавить еду вручную" : undefined}
            data-testid="nutrition-orbit-add"
            data-nutrition-orbit-mode="manual"
            data-nutrition-orbit-mic="false"
            data-nutrition-orbit-part={voiceEnabled ? "voice-manual-action" : undefined}
          >
            <Plus aria-hidden="true" />
            <span data-nutrition-orbit-text="title">
              {voiceEnabled ? "Добавить вручную" : "Добавить еду"}
            </span>
            <span className={styles.visuallyHidden} data-nutrition-orbit-text="subtitle">
              Нажмите, чтобы добавить продукты вручную
            </span>
          </button>
          {voiceEnabled && (
            <div className={styles.voiceQuickActions} data-nutrition-orbit-part="voice-quick-actions">
              <button
                type="button"
                className={`${styles.voiceQuickAction} ${styles.voiceQuickActionFood}`}
                onClick={handleVoiceAction}
                data-testid="nutrition-orbit-audio-search"
                aria-label={voiceSearchFailed ? "Повторить аудиопоиск" : "Аудиопоиск продуктов"}
              >
                {voiceSearchFailed ? <RefreshCw aria-hidden="true" /> : <Mic aria-hidden="true" />}
                <span className={styles.voiceQuickActionLabel}>
                  <span className={styles.voiceQuickActionFullLabel}>{voiceSearchFailed ? "Повторить поиск" : "Аудиопоиск"}</span>
                  <span className={styles.voiceQuickActionCompactLabel}>Аудио</span>
                </span>
              </button>
              <button
                type="button"
                className={`${styles.voiceQuickAction} ${styles.voiceQuickActionPhoto}`}
                onClick={openPhotoSearch}
                data-testid="nutrition-orbit-photo-search"
                aria-label="ИИ-поиск еды по фото"
              >
                <Camera aria-hidden="true" />
                <span className={styles.voiceQuickActionLabel}>
                  <span className={styles.voiceQuickActionFullLabel}>Найти по фото</span>
                  <span className={styles.voiceQuickActionCompactLabel}>Фото</span>
                </span>
              </button>
              <input
                ref={photoSearchInputRef}
                className={styles.photoSearchInput}
                data-testid="nutrition-orbit-photo-input"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={onPhotoSearch}
              />
            </div>
          )}
        </div>

        <div className={styles.macros} data-nutrition-orbit-part="macros">
          {macros.map((item) => (
            <div key={item.id} className={styles[item.id]}>
              <span data-nutrition-orbit-text="label">{item.label}</span>
              <strong><span data-nutrition-orbit-text="amount">{getNumericText(item.amount)}</span> / <span data-nutrition-orbit-text="target">{getNumericText(item.target)} г</span></strong>
            </div>
          ))}
        </div>
        </div>
      </section>
      <NutritionVoiceModal
        open={voiceEnabled && voiceModalOpen}
        origin={voiceButtonOrigin}
        voiceState={voiceState}
        audioLevel={voiceAudioLevel}
        feedback={voiceFeedback}
        voiceAddedItems={voiceAddedItems}
        onClose={closeVoiceModal}
        onVoiceStart={onVoiceStart}
        onVoiceEnd={onVoiceEnd}
        onVoiceAddedItemRemove={onVoiceAddedItemRemove}
        onVoiceAddedItemUpdate={onVoiceAddedItemUpdate}
        onVoiceDone={() => {
          onVoiceDone?.();
          closeVoiceModal();
        }}
      />
    </>
  );
}
