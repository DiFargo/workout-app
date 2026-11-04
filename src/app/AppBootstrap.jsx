import { lazy, Suspense, useEffect } from "react";
import clientIosThemeStyles from "../AppCoreClientIosTheme.module.css";
import { useModalFocusTrap } from "../shared/hooks/useModalFocusTrap";
import { isAdminE2EHarnessEnabled } from "../utils/adminHarness";
import { isClientE2EHarnessEnabled } from "../utils/clientHarness";
import { isTrainerE2EHarnessEnabled } from "../utils/trainerHarness";
import RouteFallback from "./RouteFallback";

// Compile-time guards keep fixtures and their exclusive assets out of every
// deployable build, including a production artifact served on localhost.
const ClientE2EHarness = import.meta.env.DEV ? lazy(() => import("../components/client/ClientE2EHarness")) : null;
const TrainerE2EHarness = import.meta.env.DEV ? lazy(() => import("../features/trainer/TrainerFullE2EHarness")) : null;
const AdminE2EHarness = import.meta.env.DEV ? lazy(() => import("../components/admin/AdminE2EHarness")) : null;

export default function AppBootstrap({ RuntimeComponent }) {
  useModalFocusTrap();
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.classList.add(clientIosThemeStyles.contract);
    body.dataset.nativeAppUi = "true";
    return () => {
      root.classList.remove(clientIosThemeStyles.contract);
      delete body.dataset.nativeAppUi;
    };
  }, []);
  const showClientHarness = import.meta.env.DEV && isClientE2EHarnessEnabled();
  const showTrainerHarness = import.meta.env.DEV && isTrainerE2EHarnessEnabled();
  const showAdminHarness = import.meta.env.DEV && isAdminE2EHarnessEnabled();

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
