import { useEffect, useRef } from "react";
import AdminWorkspace from "../components/admin/AdminWorkspace";
import AdminBaseLibrary from "../components/admin/AdminBaseLibrary";
import { BASIC_WORKOUT_EXERCISE_LIBRARY } from "../data/basicWorkoutExerciseLibrary";
import { BASIC_WORKOUT_PLANS } from "../data/basicWorkoutPlans";
import { APP_PAGES } from "./appPages";

// This catalogue is needed only after the administrator opens the library.
export default function AdminLibraryRoute({
  adminTrainingTemplates, adminBaseLibraryTab, user, onSetPage,
  openAdminClientsWithFilter, openAdminBaseLibrary, onAdminLogout, onAdminProfileClick,
  loadAdminTrainingTemplates
}) {
  const requestedLibrary = useRef(null);
  useEffect(() => {
    const key = user?.uid || "admin-library";
    if (typeof loadAdminTrainingTemplates !== "function" || requestedLibrary.current === key) return;
    requestedLibrary.current = key;
    Promise.resolve().then(() => loadAdminTrainingTemplates()).catch(error => {
      requestedLibrary.current = null;
      console.warn("Admin library demand load failed:", error);
    });
  }, [loadAdminTrainingTemplates, user?.uid]);
  const templates = Array.isArray(adminTrainingTemplates)
    ? adminTrainingTemplates.filter(template => template?.ownerRole === "admin") : [];
  const activeSection = adminBaseLibraryTab === "exercises" ? "exercises" : "programs";
  function openSection(section) {
    if (section === "overview") return onSetPage(APP_PAGES.ADMIN_PANEL);
    if (section === "users") {
      return typeof openAdminClientsWithFilter === "function"
        ? openAdminClientsWithFilter("all") : onSetPage(APP_PAGES.ADMIN_USERS);
    }
    if (section === "programs" || section === "exercises") openAdminBaseLibrary?.(section);
  }
  return <AdminWorkspace
    activeSection={activeSection}
    adminMeta="Системное управление"
    adminName={user?.displayName || user?.name || user?.email?.split("@")[0] || ""}
    adminEmail={user?.email || ""}
    headerTitle={activeSection === "exercises" ? "Базовые упражнения" : "Базовые программы"}
    onLogout={onAdminLogout} onProfileClick={onAdminProfileClick} onSectionChange={openSection}
    subtitle="Общие программы и упражнения приложения" title="Админка"
  >
    <AdminBaseLibrary key={adminBaseLibraryTab} embedded
      programTemplates={[...Object.values(BASIC_WORKOUT_PLANS), ...templates]}
      exercises={BASIC_WORKOUT_EXERCISE_LIBRARY} initialTab={adminBaseLibraryTab}
      onBack={() => onSetPage(APP_PAGES.ADMIN_PANEL)} />
  </AdminWorkspace>;
}
