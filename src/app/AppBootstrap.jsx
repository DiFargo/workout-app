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
    root.classList.add(clientIosThemeStyles.contract);
    return () => root.classList.remove(clientIosThemeStyles.contract);
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
