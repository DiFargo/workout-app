const CSS_V2_PATH_PREFIX = "/cssV2";

export function isCssV2PreviewPath(pathname = "") {
  return pathname === CSS_V2_PATH_PREFIX || pathname.startsWith(`${CSS_V2_PATH_PREFIX}/`);
}

// Keep the existing component API; V2 is now the only trainer presentation,
// including the normal entry URL and previously shared /v2 links.
export function isTrainerV2Path() {
  return true;
}

export function loadCssVariant() {
  document.documentElement.dataset.trainerVariant = "v2";
  document.body.dataset.trainerVariant = "v2";
  const isCssV2 = isCssV2PreviewPath(window.location.pathname);
  const variant = isCssV2 ? "v2" : "current";

  document.documentElement.dataset.cssVariant = variant;
  document.body.dataset.cssVariant = variant;

  // Role-specific styles travel with the trainer routes, not every login.
  return isCssV2 ? import("./CssVariantPreview.module.css") : Promise.resolve();
}
