export const CSS_VARIANT = "v2";

export function loadCssVariant() {
  document.documentElement.dataset.cssVariant = CSS_VARIANT;
  document.body.dataset.cssVariant = CSS_VARIANT;
  return Promise.resolve();
}
