import { APP_VERSION } from "../constants/appConfig.js";

export const APP_THEMES = Object.freeze({
  WARM_LIGHT: "warm-light"
});

export const DEFAULT_APP_THEME = APP_THEMES.WARM_LIGHT;

export { APP_VERSION };

export function normalizeAppTheme(theme) {
  // Legacy values remain readable, but the product now has one supported
  // visual system and must never render a hybrid theme.
  void theme;
  return APP_THEMES.WARM_LIGHT;
}
