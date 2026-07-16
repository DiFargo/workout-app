const CSS_V2_PATH_PREFIX = "/cssV2";

export function isCssV2PreviewPath(pathname = "") {
  return pathname === CSS_V2_PATH_PREFIX || pathname.startsWith(`${CSS_V2_PATH_PREFIX}/`);
}

export function loadCssVariant() {
  const isCssV2 = isCssV2PreviewPath(window.location.pathname);
  const variant = isCssV2 ? "v2" : "current";

  document.documentElement.dataset.cssVariant = variant;
  document.body.dataset.cssVariant = variant;

  return isCssV2 ? import("../css-v2/index.css") : Promise.resolve();
}
