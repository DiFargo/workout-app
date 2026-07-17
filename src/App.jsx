import { lazy, Suspense } from "react";
import AppErrorBoundary from "./components/common/AppErrorBoundary";
import { AppSplash } from "./components/auth/AuthScreens";

const AppCore = lazy(() => import("./AppCore"));

export default function App() {
  return (
    <AppErrorBoundary>
      <Suspense
        fallback={<AppSplash />}
      >
        <AppCore />
      </Suspense>
    </AppErrorBoundary>
  );
}
