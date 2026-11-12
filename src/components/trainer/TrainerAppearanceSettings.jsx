import { Check, Moon, Sun } from "lucide-react";
import TrainerClientUtilitySheet from "./TrainerClientUtilitySheet.jsx";
import { setTrainerAppearance, useTrainerAppearancePreference } from "./useTrainerAppearance.js";
import styles from "./TrainerAppearance.module.css";

export default function TrainerAppearanceSettings({ onClose }) {
  const preference = useTrainerAppearancePreference();
  return (
    <TrainerClientUtilitySheet title="Оформление" variant="appearance" onRequestClose={onClose}>
      <div className={styles.themeChoices}>
        <p>Выбери удобный вид тренерского кабинета.</p>
        <div role="radiogroup" aria-label="Тема тренерского кабинета">
        {[["light", "Светлая", Sun], ["dark", "Тёмная", Moon]].map(([value, label, Icon]) => (
          <button key={value} type="button" role="radio" aria-checked={preference === value}
            tabIndex={preference === value ? 0 : -1}
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const next = event.key === "Home" ? "light" : event.key === "End" ? "dark" : value === "light" ? "dark" : "light";
              setTrainerAppearance(next);
              event.currentTarget.parentElement.querySelector(`[data-theme-option="${next}"]`)?.focus();
            }}
            data-theme-option={value}
            onClick={() => setTrainerAppearance(value)}>
            <Icon size={20} aria-hidden="true" /><span>{label}</span>
            {preference === value ? <Check size={20} aria-hidden="true" /> : null}
          </button>
        ))}
        </div>
        <button type="button" onClick={onClose}>Готово</button>
      </div>
    </TrainerClientUtilitySheet>
  );
}
