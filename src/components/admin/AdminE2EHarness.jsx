import { useState } from "react";
import AdminPanelHub from "./AdminPanelHub";

function getAdminHarnessAccess() {
  if (typeof window === "undefined") return true;
  return new URLSearchParams(window.location.search).get("adminAccess") !== "denied";
}

export default function AdminE2EHarness() {
  const [lastAction, setLastAction] = useState("idle");
  const canAccessAdmin = getAdminHarnessAccess();

  return (
    <main data-testid="admin-harness-root">
      <AdminPanelHub
        canUseAdminFeatures={() => canAccessAdmin}
        setPage={(page) => setLastAction(`page:${page}`)}
        openAdminProgramsOverview={() => setLastAction("programs")}
      />
      <output data-testid="admin-harness-action">{lastAction}</output>
    </main>
  );
}
