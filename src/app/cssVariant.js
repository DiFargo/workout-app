const CSS_V2_PATH_PREFIX = "/cssV2";

export function isCssV2PreviewPath(pathname = "") {
  return pathname === CSS_V2_PATH_PREFIX || pathname.startsWith(`${CSS_V2_PATH_PREFIX}/`);
}

export function isTrainerV2Path(pathname = "") {
  return pathname === "/v2" || pathname.startsWith("/v2/");
}

export function loadCssVariant() {
  const isTrainerV2 = isTrainerV2Path(window.location.pathname);
  document.documentElement.dataset.trainerVariant = isTrainerV2 ? "v2" : "current";
  document.body.dataset.trainerVariant = isTrainerV2 ? "v2" : "current";
  const isCssV2 = isCssV2PreviewPath(window.location.pathname);
  const variant = isCssV2 ? "v2" : "current";

  document.documentElement.dataset.cssVariant = variant;
  document.body.dataset.cssVariant = variant;

  return Promise.all([
    isCssV2 ? import("./CssVariantPreview.module.css") : Promise.resolve(),
    isTrainerV2 ? import("../components/trainer/TrainerWorkspaceV2.module.css") : Promise.resolve()
  ]);
}
