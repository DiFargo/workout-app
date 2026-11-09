import { useLayoutEffect, useSyncExternalStore } from "react";
import styles from "./ClientAppearance.module.css";

const STORAGE_KEY = "zmena-client-appearance-v1";
const CHANGE_EVENT = "zmena-client-appearance-change";
const choices = new Set(["light", "dark"]);
let volatilePreference = null;

function resolveLegacyPreference(value) {
  if (choices.has(value)) return value;
  if (value !== "system") return "light";
  const telegram = window.Telegram?.WebApp;
  const liveTelegram = Boolean(telegram?.initData || (telegram?.platform && telegram.platform !== "unknown"));
  return (liveTelegram ? telegram.colorScheme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
}

function readPreference() {
  if (volatilePreference) return volatilePreference;
  try { return resolveLegacyPreference(localStorage.getItem(STORAGE_KEY)); }
  catch { return "light"; }
}

function subscribe(listener) {
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => { window.removeEventListener(CHANGE_EVENT, listener); window.removeEventListener("storage", listener); };
}

export function setClientAppearance(value) {
  if (!choices.has(value)) return;
  try { localStorage.setItem(STORAGE_KEY, value); volatilePreference = null; }
  catch { volatilePreference = value; }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: value }));
}

export function useClientAppearancePreference() {
  return useSyncExternalStore(subscribe, readPreference, () => "light");
}

// Presentation only: no account, role, cloud preference or navigation is changed.
export function useClientAppearance(active = true) {
  useLayoutEffect(() => {
    if (!active) return undefined;
    const root = document.documentElement;
    root.classList.add(styles.scope);
    const telegram = window.Telegram?.WebApp;
    const liveTelegram = Boolean(telegram?.initData || (telegram?.platform && telegram.platform !== "unknown"));
    let preference = readPreference();
    // Resolve the retired system choice once; only explicit light/dark remain.
    try { localStorage.setItem(STORAGE_KEY, preference); } catch { volatilePreference = preference; }
    function apply(event) {
      preference = choices.has(event?.detail) ? event.detail : readPreference();
      const dark = preference === "dark";
      root.dataset.clientAppearance = dark ? "dark" : "light";
      if (liveTelegram && telegram.isVersionAtLeast?.("6.1")) {
        try {
          telegram.setBackgroundColor(dark ? "#08080b" : "#edf4f7");
          telegram.setHeaderColor(telegram.isVersionAtLeast("6.9") ? (dark ? "#08080b" : "#f2f7fa") : "bg_color");
          if (telegram.isVersionAtLeast("7.10")) telegram.setBottomBarColor?.(dark ? "#08080b" : "#edf4f7");
        } catch { /* Older Telegram hosts keep their native colors. */ }
      }
    }
    apply();
    window.addEventListener(CHANGE_EVENT, apply);
    window.addEventListener("storage", apply);
    if (liveTelegram) telegram.onEvent?.("themeChanged", apply);
    return () => {
      delete root.dataset.clientAppearance;
      root.classList.remove(styles.scope);
      window.removeEventListener(CHANGE_EVENT, apply);
      window.removeEventListener("storage", apply);
      if (liveTelegram) telegram.offEvent?.("themeChanged", apply);
    };
  }, [active]);
}
