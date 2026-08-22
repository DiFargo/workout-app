import { APP_PAGES } from "../../app/appPages";
import AdminWorkspace from "../../components/admin/AdminWorkspace";
import TrainerClientsWorkspaceRoute from "./TrainerClientsWorkspaceRoute";

/**
 * Presents a regular client's existing detail content inside the admin shell.
 * The trainer route keeps using TrainerClientsWorkspaceRoute without `embedded`,
 * so its navigation and workspace remain unchanged.
 */
export default function AdminClientProfileRoute(props) {
  const {
    adminName,
    logout,
    openAdminBaseLibrary,
    openAdminClientsWithFilter,
    openProfileAccount,
    setAdminClientPageOpen,
    setAdminClientStatus,
    setAdminSelectedClient,
    setPage,
    setTrainerNextSection,
    user
  } = props;

  const returnToUsers = () => {
    setAdminClientStatus?.("");
    setAdminSelectedClient?.(null);
    setAdminClientPageOpen?.(false);
    setTrainerNextSection?.("clients");

    if (typeof openAdminClientsWithFilter === "function") {
      openAdminClientsWithFilter("clients");
      return;
    }

    setPage?.(APP_PAGES.ADMIN_USERS);
  };

  const openAdminSection = (sectionId) => {
    if (sectionId === "users") {
      returnToUsers();
      return;
    }

    setAdminClientStatus?.("");
    setAdminSelectedClient?.(null);
    setAdminClientPageOpen?.(false);

    if (sectionId === "overview") {
      setPage?.(APP_PAGES.ADMIN_PANEL);
      return;
    }

    const tab = sectionId === "exercises" ? "exercises" : "programs";
    if (typeof openAdminBaseLibrary === "function") {
      openAdminBaseLibrary(tab);
      return;
    }

    setPage?.(APP_PAGES.ADMIN_LIBRARY);
  };

  return (
    <AdminWorkspace
      activeSection="users"
      adminEmail={user?.email || ""}
      adminMeta="Системное управление"
      adminName={adminName || user?.displayName || user?.name || user?.email?.split("@")[0] || "Администратор"}
      headerTitle="Карточка клиента"
      onLogout={logout}
      onProfileClick={openProfileAccount}
      onSectionChange={openAdminSection}
      subtitle="Данные клиента, его программа и прогресс"
      testId="admin-client-profile-workspace"
      title="Админка"
    >
      <TrainerClientsWorkspaceRoute
        {...props}
        embedded
        onCloseClient={returnToUsers}
      />
    </AdminWorkspace>
  );
}
