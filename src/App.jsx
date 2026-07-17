import { lazy, Suspense } from "react";
import AppErrorBoundary from "./components/common/AppErrorBoundary";
import styles from "./App.module.css";

const AppCore = lazy(() => import("./AppCore"));

export default function App() {
  return (
    <AppErrorBoundary>
      <Suspense
        fallback={(
          <main className={styles.loading} aria-label="Загрузка приложения">
            <span className={styles.spinner} aria-hidden="true" />
          </main>
        )}
      >
        <AppCore />
      </Suspense>
    </AppErrorBoundary>
  );
}
