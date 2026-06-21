import { APP_VERSION } from "../constants/appConfig";

export const APP_THEMES = Object.freeze({
  WARM_LIGHT: "warm-light",
  DARK_GREEN: "dark-green"
});

export const DEFAULT_APP_THEME = APP_THEMES.DARK_GREEN;

export { APP_VERSION };

export function normalizeAppTheme(theme) {
  return theme === APP_THEMES.WARM_LIGHT ? APP_THEMES.WARM_LIGHT : APP_THEMES.DARK_GREEN;
}
