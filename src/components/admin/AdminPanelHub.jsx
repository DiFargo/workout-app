import { AlertCircle, ArrowLeft, Clock3, ShieldCheck, UsersRound } from "lucide-react";
import { APP_PAGES } from "../../app/appPages";
import AdminWorkspace from "./AdminWorkspace";
import styles from "./AdminPanelHub.module.css";

export default function AdminPanelHub({
  canUseAdminFeatures,
  setPage,
  openAdminClientsWithFilter,
  openAdminBaseLibrary,
  openAdminProgramsOverview,
  onLogout,
  onProfileClick,
  user,
  adminAllUsersList
}) {
  const allUsers = Array.isArray(adminAllUsersList) ? adminAllUsersList : [];
  const getRole = (item) => String(item?.role || "client").trim().toLocaleLowerCase("ru");
  const getStatus = (item) => String(item?.accountStatus || item?.status || "").trim().toLocaleLowerCase("ru");
  const getTrainerLink = (item) => String(item?.assignedTrainerId || item?.trainerId || item?.coachId || "").trim();
  const clients = allUsers.filter((item) => getRole(item) === "client");
  const trainers = allUsers.filter((item) => getRole(item) === "trainer");
  const clientsCount = clients.length;
  const trainersCount = trainers.length;
  const unassignedClients = clients.filter((item) => !getTrainerLink(item));
  const pendingTrainerInvites = trainers.filter((item) => ["invited", "pending", "created", "ожидает", "приглашён"].includes(getStatus(item)));
  const suspendedTrainers = trainers.filter((item) => Boolean(item?.accessDisabled) || ["suspended", "blocked", "disabled", "inactive", "приостановлен", "заблокирован"].includes(getStatus(item)));
  const overviewStats = allUsers.length
    ? [
      { id: "users", label: "Пользователей", value: allUsers.length, icon: UsersRound },
      { id: "clients", label: "Клиентов", value: clientsCount, icon: UsersRound },
      { id: "trainers", label: "Тренеров", value: trainersCount, icon: UsersRound }
    ]
    : [];
  const overviewQueue = [
    {
      id: "unassigned-clients",
      title: "Клиенты без тренера",
      description: "Назначьте ответственного тренера, чтобы клиент попал в рабочую очередь.",
      count: unassignedClients.length,
      actionLabel: "Назначить",
      icon: UsersRound,
      target: "clients"
    },
    {
      id: "pending-invites",
      title: "Ожидают активации",
      description: "Проверьте приглашения тренеров, отправьте новую ссылку или отзовите её.",
      count: pendingTrainerInvites.length,
      actionLabel: "Проверить",
      icon: Clock3,
      target: "trainers"
    },
    {
      id: "suspended-trainers",
      title: "Приостановленные тренеры",
      description: "Проверьте доступ и назначенных клиентов перед восстановлением работы.",
      count: suspendedTrainers.length,
      actionLabel: "Открыть",
      icon: AlertCircle,
      target: "trainers"
    }
  ];
  const openSection = (sectionId) => {
    if (sectionId === "overview") return;

    if (sectionId === "users") {
      if (typeof openAdminClientsWithFilter === "function") {
        openAdminClientsWithFilter("all");
      } else {
        setPage(APP_PAGES.ADMIN_USERS);
      }
      return;
    }

    if (sectionId === "programs" || sectionId === "exercises") {
      if (typeof openAdminBaseLibrary === "function") {
        openAdminBaseLibrary(sectionId);
      } else if (sectionId === "programs" && typeof openAdminProgramsOverview === "function") {
        openAdminProgramsOverview();
      } else {
        setPage(APP_PAGES.ADMIN_LIBRARY);
      }
      return;
    }

    return;
  };

  const openQueueItem = (item) => {
    if (item?.target === "trainers") {
      openAdminClientsWithFilter?.("trainers");
      return;
    }

    openAdminClientsWithFilter?.("clients");
  };

  if (!canUseAdminFeatures()) {
    return (
      <main className={styles.root}>
        <button className={styles.backButton} type="button" onClick={() => setPage("main")}>
          <ArrowLeft aria-hidden="true" />
          <span>Главное меню</span>
        </button>
        <section className={styles.deniedCard}>
          <ShieldCheck aria-hidden="true" />
          <h1>Доступ закрыт</h1>
          <p>Кабинет администратора доступен только главному администратору.</p>
        </section>
      </main>
    );
  }

  return (
    <AdminWorkspace
      activeSection="overview"
      adminMeta="Системное управление"
      adminName={user?.displayName || user?.name || user?.email?.split("@")[0] || ""}
      adminEmail={user?.email || ""}
      onLogout={onLogout}
      onProfileClick={onProfileClick}
      onSectionChange={openSection}
      onOverviewQueueAction={openQueueItem}
      overviewQueue={overviewQueue}
      overviewStats={overviewStats}
      subtitle="Пользователи, роли и общие материалы приложения"
      testId="admin-panel-hub"
      title="Админка"
    />
  );
}
