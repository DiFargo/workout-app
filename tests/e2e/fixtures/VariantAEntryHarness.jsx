import { useState } from "react";
import { createRoot } from "react-dom/client";
import { AppStartupGate } from "../../../src/app/appStartupGate";
import { useAppBackNavigation } from "../../../src/shared/hooks/useAppBackNavigation";
import { useModalBackNavigation } from "../../../src/shared/hooks/useModalBackNavigation";
import "../../../src/styles/index.css";

function BackDialog({ open, busy, title, onClose, children }) {
  useModalBackNavigation({ open, onBack: () => { if (!busy) onClose(); } });
  return open ? <section role="dialog" aria-label={title} aria-modal="true"><h2>{title}</h2>{children}<button type="button" disabled={busy} onClick={onClose}>Закрыть {title}</button></section> : null;
}

function BackHarness() {
  const [lower, setLower] = useState(false);
  const [upper, setUpper] = useState(false);
  const [busy, setBusy] = useState(false);
  const [routeBacks, setRouteBacks] = useState(0);
  useAppBackNavigation({ isLoggedIn: true, appLoading: false, page: "adminUsers", hasTransientScreen: false,
    isPrimaryPage: () => false, handleTransientBack: () => { setRouteBacks(value => value + 1); return true; } });
  return <main><output data-testid="route-backs">{routeBacks}</output><button type="button" onClick={() => setLower(true)}>Открыть окно</button>
    <BackDialog open={lower} title="Нижнее окно" onClose={() => setLower(false)}><button type="button" onClick={() => setUpper(true)}>Открыть верхнее</button></BackDialog>
    <BackDialog open={upper} busy={busy} title="Верхнее окно" onClose={() => setUpper(false)}><button type="button" onClick={() => setBusy(value => !value)}>{busy ? "Завершить операцию" : "Начать операцию"}</button></BackDialog>
  </main>;
}

function StableBackScene() {
  const [page, setPage] = useState("workouts");
  const [tick, setTick] = useState(0);
  const [modal, setModal] = useState(false);
  const [lastBack, setLastBack] = useState("");
  useAppBackNavigation({
    isLoggedIn: true, appLoading: false, page, hasTransientScreen: false,
    isPrimaryPage: value => ["main", "workouts"].includes(value),
    handleTransientBack: () => { setLastBack(`${page}:${tick}`); return true; },
    restorePrimaryPage: value => setPage(value)
  });
  return <main>
    <output data-testid="stable-back-state">{page}:{tick}</output>
    <output data-testid="stable-back-result">{lastBack}</output>
    <button type="button" onClick={() => setTick(value => value + 1)}>Обновить таймер</button>
    <button type="button" onClick={() => setPage("workoutDetail")}>Открыть тренировку</button>
    <button type="button" onClick={() => setPage("workouts")}>Открыть тренировки</button>
    <button type="button" onClick={() => setPage("main")}>Открыть главную</button>
    <button type="button" onClick={() => setModal(true)}>Открыть sheet</button>
    <BackDialog open={modal} title="Проверка стабильности" onClose={() => setModal(false)} />
  </main>;
}

function StableBackHarness() {
  const [mounted, setMounted] = useState(true);
  return <><button type="button" onClick={() => setMounted(value => !value)}>{mounted ? "Размонтировать экран" : "Смонтировать экран"}</button>{mounted && <StableBackScene />}</>;
}

export default function Harness() {
  const [loggedOut, setLoggedOut] = useState(false);
  if (new URLSearchParams(location.search).get("mode") === "stable-back") return <StableBackHarness />;
  if (new URLSearchParams(location.search).get("mode") === "back") return <BackHarness />;
  return loggedOut ? <p>Вы вышли</p> : <AppStartupGate isLoggedIn currentUserRole="pending-client"
    user={{ uid: "fixture-own-account-identifier-001" }} profileAccount={{ login: "my_fitness_account" }} logout={() => setLoggedOut(true)} />;
}
createRoot(document.getElementById("root")).render(<Harness />);
