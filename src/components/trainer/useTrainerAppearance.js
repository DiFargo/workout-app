import { useLayoutEffect, useSyncExternalStore } from "react";
import styles from "./TrainerAppearance.module.css";

const STORAGE_KEY = "gymduck-trainer-appearance-v1";
const CHANGE_EVENT = "gymduck-trainer-appearance-change";
let sessionPreference = null;

function readPreference() {
  if (sessionPreference) return sessionPreference;
  try { return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light"; }
  catch { return "light"; }
}

function subscribe(listener) {
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function setTrainerAppearance(value) {
  if (value !== "light" && value !== "dark") return;
  try { localStorage.setItem(STORAGE_KEY, value); sessionPreference = null; }
  catch { sessionPreference = value; }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function useTrainerAppearancePreference() {
  return useSyncExternalStore(subscribe, readPreference, () => "light");
}

// Presentation only. Embedded admin workspaces never mount this hook.
export function useTrainerAppearance() {
  const preference = useTrainerAppearancePreference();
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.trainerAppearance = preference;
    root.classList.add(styles.document);
    const telegram = window.Telegram?.WebApp;
    if (telegram?.initData && telegram.isVersionAtLeast?.("6.1")) {
      try {
        telegram.setBackgroundColor(preference === "dark" ? "#080b0e" : "#edf4f7");
        if (telegram.isVersionAtLeast("6.9")) telegram.setHeaderColor(preference === "dark" ? "#080b0e" : "#edf4f7");
      } catch { /* The native host can keep its own colors. */ }
    }
    return () => {
      delete root.dataset.trainerAppearance;
      root.classList.remove(styles.document);
    };
  }, [preference]);
  return preference;
}
