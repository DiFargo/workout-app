import { lazy, Suspense, useEffect } from "react";
import clientIosThemeStyles from "../AppCoreClientIosTheme.module.css";
import { usePreventMobileZoom } from "../shared/hooks/usePreventMobileZoom";
import { useModalFocusTrap } from "../shared/hooks/useModalFocusTrap";
import { isAdminE2EHarnessEnabled } from "../utils/adminHarness";
import { isClientE2EHarnessEnabled } from "../utils/clientHarness";
import { isTrainerE2EHarnessEnabled } from "../utils/trainerHarness";
import RouteFallback from "./RouteFallback";

const ClientE2EHarness = lazy(() => import("../components/client/ClientE2EHarness"));
const TrainerE2EHarness = lazy(() => import("../features/trainer/TrainerFullE2EHarness"));
const AdminE2EHarness = lazy(() => import("../components/admin/AdminE2EHarness"));

export default function AppBootstrap({ RuntimeComponent }) {
  useModalFocusTrap();
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const previousTranslate = root.getAttribute("translate");
    const previousBodyTranslate = body.getAttribute("translate");
    root.classList.add(clientIosThemeStyles.contract);
    root.classList.add("notranslate");
    root.setAttribute("translate", "no");
    body.setAttribute("translate", "no");
    body.dataset.nativeAppUi = "true";

    const isEditable = (element) => element instanceof Element && Boolean(
      element.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]')
    );
    const preventUiCopy = (event) => {
      if (!isEditable(document.activeElement)) event.preventDefault();
    };
    const preventUiContextMenu = (event) => {
      if (!isEditable(event.target)) event.preventDefault();
    };

    document.addEventListener("copy", preventUiCopy);
    document.addEventListener("contextmenu", preventUiContextMenu);

    return () => {
      root.classList.remove(clientIosThemeStyles.contract, "notranslate");
      if (previousTranslate === null) root.removeAttribute("translate");
      else root.setAttribute("translate", previousTranslate);
      if (previousBodyTranslate === null) body.removeAttribute("translate");
      else body.setAttribute("translate", previousBodyTranslate);
      delete body.dataset.nativeAppUi;
      document.removeEventListener("copy", preventUiCopy);
      document.removeEventListener("contextmenu", preventUiContextMenu);
    };
  }, []);
  const showClientHarness = isClientE2EHarnessEnabled();
  const showTrainerHarness = isTrainerE2EHarnessEnabled();
  const showAdminHarness = isAdminE2EHarnessEnabled();
  usePreventMobileZoom();

  if (showClientHarness) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <ClientE2EHarness />
      </Suspense>
    );
  }

  if (showTrainerHarness) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <TrainerE2EHarness />
      </Suspense>
    );
  }

  if (showAdminHarness) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <AdminE2EHarness />
      </Suspense>
    );
  }

  return <RuntimeComponent />;
}
