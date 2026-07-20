import { Flame, Plus } from "lucide-react";
import styles from "./NutritionOrbit.module.css";

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

export default function NutritionOrbit({ items = [], dateTitle, dateKey, streakText, onAdd }) {
  const calories = items[0] || {};
  const macros = [items[1], items[3], items[2]].filter(Boolean);
  const circumference = 2 * Math.PI * 64;
  const calorieProgress = Math.min(100, Math.max(0, Number(calories.progress) || 0));
  const streakDays = Number(String(streakText || "").match(/\d+/)?.[0] || 0);

  return (
    <section className={styles.root} aria-label="Добавить еду" data-testid="nutrition-orbit" data-css-module-scope="nutrition-orbit">
      <div className={styles.card} data-nutrition-orbit-part="card">
        <header className={styles.header}>
          <div><h2>{dateTitle || "Сегодня"}</h2><small>{formatSelectedDate(dateKey, dateTitle)}</small></div>
          <span className={styles.streak}><Flame aria-hidden="true" />{streakDays} {streakDays === 1 ? "день" : "дня"} подряд</span>
        </header>

        <div className={styles.stage} data-nutrition-orbit-part="stage">
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
          <button type="button" className={styles.hitButton} onClick={onAdd} data-testid="nutrition-orbit-add">
            <Plus aria-hidden="true" /><span data-nutrition-orbit-text="title">Добавить еду</span>
            <span className={styles.visuallyHidden} data-nutrition-orbit-text="subtitle">Нажмите, чтобы добавить продукты</span>
          </button>
        </div>

        <div className={styles.macros}>
          {macros.map((item) => (
            <div key={item.id} className={styles[item.id]}>
              <span data-nutrition-orbit-text="label">{item.label}</span>
              <strong><span data-nutrition-orbit-text="amount">{getNumericText(item.amount)}</span> / <span data-nutrition-orbit-text="target">{getNumericText(item.target)} г</span></strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
