import { lazy, Suspense } from "react";
import AppErrorBoundary from "./components/common/AppErrorBoundary";

const AppCore = lazy(() => import("./AppCore"));

function AppModuleSurface() {
  return (
    <div
      aria-hidden="true"
      style={{ minHeight: "100dvh", background: "#f3f4f3" }}
    />
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <Suspense
        fallback={<AppModuleSurface />}
      >
        <AppCore />
      </Suspense>
    </AppErrorBoundary>
  );
}
