import { useState } from "react";
import { createRoot } from "react-dom/client";
import AdminPanelHub from "../../src/components/admin/AdminPanelHub";
import AdminUsersWorkspaceRoute from "../../src/features/trainer/AdminUsersWorkspaceRoute";
import AdminTrainerProfileRoute from "../../src/features/trainer/AdminTrainerProfileRoute";
import AdminLibraryRoute from "../../src/app/AdminLibraryRoute";
import { APP_PAGES } from "../../src/app/appPages";
import { useModalFocusTrap } from "../../src/shared/hooks/useModalFocusTrap";
import { localRequest } from "./apiClient.js";
import "../../src/styles/index.css";
import "../../src/styles/_variables.css";
import "../../src/AppCoreTheme.module.css";
import "../../src/shared/ui/ResponsiveModalLayer.module.css";
import "../../src/AppCoreClientAppleTheme.css";
import clientIosThemeStyles from "../../src/AppCoreClientIosTheme.module.css";
import styles from "./preview.module.css";

document.documentElement.classList.add(clientIosThemeStyles.contract);
document.documentElement.dataset.trainerVariant = "v2";
document.body.dataset.nativeAppUi = "true";
const initial = await localRequest("/__preview/users");

export default function AdminPreview() {
  useModalFocusTrap();
  const [page, setPage] = useState(APP_PAGES.ADMIN_PANEL);
  const [tab, setTab] = useState("programs");
  const [users, setUsers] = useState(initial.users);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const integrationNotice = () => setNotice("Для входа, профиля аккаунта и интеграций используйте отдельное staging-окружение.");
  const navigatePage = target => {
    if ([APP_PAGES.ADMIN_PANEL, APP_PAGES.ADMIN_USERS, APP_PAGES.ADMIN_LIBRARY].includes(target)) setPage(target);
    else {
      // The trainer route closes its profile before requesting its workspace.
      // Keep the current local profile available when that route is unsupported.
      if (page === APP_PAGES.ADMIN_USERS && selected?.role === "trainer") setProfileOpen(true);
      setNotice("Этот раздел требует отдельного staging-окружения. Локально доступны обзор, каталог пользователей и базовая библиотека.");
    }
  };
  const loadUsers = async () => setUsers((await localRequest("/__preview/users")).users);
  const openUsers = value => { setFilter(value); setSelected(null); setProfileOpen(false); setPage(APP_PAGES.ADMIN_USERS); };
  const openLibrary = value => { setTab(value); setPage(APP_PAGES.ADMIN_LIBRARY); };
  const ctx = {
    user: initial.user, canUseAdminFeatures: () => true, adminAllUsersList: users, usersList: users,
    setAdminAllUsersList: setUsers, loadUsers, setPage: navigatePage,
    logout: integrationNotice, onLogout: integrationNotice, onProfileClick: integrationNotice, openProfileAccount: integrationNotice,
    openAdminClientsWithFilter: openUsers, openAdminBaseLibrary: openLibrary,
    selectedClient: selected, setAdminSelectedClient: setSelected,
    setAdminClientPageOpen: setProfileOpen, setAdminClientStatus: setNotice,
    adminUsersSearch: search, setAdminUsersSearch: setSearch,
    adminClientFilter: filter, setAdminClientFilter: setFilter,
    adminUsersSelectedTab: filter, setAdminUsersSelectedTab: setFilter,
    adminTrainingTemplates: [],
    loadAdminTrainingTemplates: async () => [],
    loadAdminClientOverview: client => { setSelected(client); setNotice("В локальном просмотре нет персональных данных клиента. Каталог пользователей и назначение тренера доступны на этой странице."); },
    showAppConfirm: async value => window.confirm(`${value.title}\n${value.text}\n${value.confirmText}`)
  };
  return <>
    {page === APP_PAGES.ADMIN_PANEL ? <AdminPanelHub {...ctx} onLogout={integrationNotice} /> : null}
    {page === APP_PAGES.ADMIN_USERS ? profileOpen && selected?.role === "trainer"
      ? <AdminTrainerProfileRoute {...ctx} /> : <AdminUsersWorkspaceRoute {...ctx} /> : null}
    {page === APP_PAGES.ADMIN_LIBRARY ? <AdminLibraryRoute {...ctx} adminBaseLibraryTab={tab}
      onSetPage={navigatePage} onAdminLogout={integrationNotice} onAdminProfileClick={integrationNotice} /> : null}
    <aside className={styles.notice} aria-label="Локальный просмотр">
      <details open={Boolean(notice)}><summary>Локальный просмотр</summary><p>Реальный интерфейс · синтетические данные. Изменения хранятся в памяти этого сервера; перезапуск их сбросит. Облако и отправка сообщений отключены.</p>
        {notice ? <p role="status">{notice}</p> : null}
      </details>
    </aside>
  </>;
}

createRoot(document.getElementById("root")).render(<AdminPreview />);
