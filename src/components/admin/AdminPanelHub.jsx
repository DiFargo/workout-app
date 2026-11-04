import { AlertCircle, ArrowLeft, Bot, Clock3, ShieldCheck, UsersRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { APP_PAGES } from "../../app/appPages";
import { TELEGRAM_BOT_USERNAME } from "../../constants/appConfig.js";
import { app } from "../../firebase";
import { useModalBackNavigation } from "../../shared/hooks/useModalBackNavigation.js";
import { fetchAuthorizedWithTimeout } from "../../utils/apiClient";
import AdminWorkspace from "./AdminWorkspace";
import { getAdminAccountStatus } from "./AdminUsersWorkspace";
import { matchesAdminAttentionFilter } from "./adminAttentionQueue.js";
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
  const [telegramSetupStatus, setTelegramSetupStatus] = useState("");
  const [telegramSetupBusy, setTelegramSetupBusy] = useState(false);
  const [telegramReconnectOpen, setTelegramReconnectOpen] = useState(false);
  const projectId = app.options.projectId || "не указано";
  const environment = projectId === "tren-85720" ? "Production" : projectId === "tren-85720-staging" ? "Staging" : "Локальное / тестовое";
  const host = typeof window === "undefined" ? "не указан" : window.location.host;
  useModalBackNavigation({ open: telegramReconnectOpen, onBack: () => { if (!telegramSetupBusy) setTelegramReconnectOpen(false); } });
  useEffect(() => {
    if (!telegramReconnectOpen) return undefined;
    const onKeyDown = event => { if (event.key === "Escape" && !telegramSetupBusy) setTelegramReconnectOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [telegramReconnectOpen, telegramSetupBusy]);
  const allUsers = Array.isArray(adminAllUsersList) ? adminAllUsersList : [];
  const getRole = (item) => String(item?.role || "client").trim().toLocaleLowerCase("ru");
  const clients = allUsers.filter((item) => getRole(item) === "client");
  const trainers = allUsers.filter((item) => getRole(item) === "trainer");
  const clientsCount = clients.length;
  const trainersCount = trainers.length;
  const queueUsers = filter => allUsers.filter(item => matchesAdminAttentionFilter(item, filter, getRole(item), getAdminAccountStatus(item).id));
  const unassignedClients = queueUsers("unassigned-clients");
  const pendingTrainerInvites = queueUsers("pending-invites");
  const suspendedTrainers = queueUsers("suspended-trainers");
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
      title: "Ограничен доступ тренеров",
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
    if (["unassigned-clients", "pending-invites", "suspended-trainers"].includes(item?.id))
      openAdminClientsWithFilter?.(item.id);
  };

  const connectTelegramBot = async () => {
    if (telegramSetupBusy || !telegramReconnectOpen) return;
    setTelegramSetupBusy(true);
    setTelegramSetupStatus("");
    try {
      const response = await fetchAuthorizedWithTimeout("/api/telegram/set-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      }, 15000);
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        const error = new Error(result.error || "setup-failed");
        error.actualUsername = result.actualUsername || "";
        error.expectedUsername = result.expectedUsername || "";
        throw error;
      }
      setTelegramSetupStatus("Сервер подтвердил команду переподключения. Доставка /start отдельно не проверялась.");
      setTelegramReconnectOpen(false);
    } catch (error) {
      setTelegramSetupStatus(error?.message === "Telegram bot token does not match configured bot"
        ? `Токен бота относится к @${error.actualUsername}, а приложение настроено на @${error.expectedUsername}. Нужна проверка серверной конфигурации окружения ${environment}.`
        : "Не удалось подключить бота. Проверь вход администратора и повтори.");
    } finally {
      setTelegramSetupBusy(false);
    }
  };

  if (!canUseAdminFeatures()) {
    return (
      <main className={styles.root}>
        <button className={styles.backButton} type="button" aria-label="Главное меню" onClick={() => setPage("main")}>
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
      onOverviewStatAction={item => typeof openAdminClientsWithFilter === "function"
        ? openAdminClientsWithFilter(item.id === "users" ? "all" : item.id)
        : setPage(APP_PAGES.ADMIN_USERS)}
      overviewQueue={overviewQueue}
      overviewStats={overviewStats}
      overviewSupplement={(
        <details className={styles.systemSection}>
          <summary><span><ShieldCheck size={20} aria-hidden="true" /><strong>Система и Telegram</strong></span><small>Настройки окружения и обслуживание</small></summary>
        <section className={styles.telegramSetup} aria-labelledby="admin-telegram-setup-title">
          <span className={styles.telegramSetupIcon} aria-hidden="true"><Bot size={20} /></span>
          <div>
            <h2 id="admin-telegram-setup-title">Telegram-бот</h2>
            <p>Серверное подключение не проверено. Обычная публикация приложения не требует переподключения webhook.</p>
            <details className={styles.telegramDiagnostics}>
              <summary>Диагностика подключения</summary>
              <dl><dt>Окружение приложения</dt><dd>{environment} · {projectId}</dd><dt>Ожидаемый бот</dt><dd>@{TELEGRAM_BOT_USERNAME}</dd><dt>Текущий сайт</dt><dd>{host}</dd></dl>
              <p>Это локальная конфигурация, не ответ Telegram. Токен, текущий webhook и доставка сообщений здесь не проверяются.</p>
            </details>
            {telegramSetupStatus && !telegramReconnectOpen ? <small role="status">{telegramSetupStatus}</small> : null}
            <details className={styles.telegramMaintenance}>
              <summary>Обслуживание бота</summary>
              <p>Переподключение меняет webhook бота для этого окружения. Выполняйте только при подтверждённой необходимости.</p>
              <button type="button" onClick={() => setTelegramReconnectOpen(true)} disabled={telegramSetupBusy}>Переподключить webhook</button>
            </details>
          </div>
          {telegramReconnectOpen ? <div className={styles.confirmOverlay} data-modal-backdrop="true" role="presentation" onMouseDown={() => !telegramSetupBusy && setTelegramReconnectOpen(false)}>
            <section className={styles.confirmSheet} role="dialog" aria-modal="true" aria-busy={telegramSetupBusy} aria-labelledby="admin-webhook-confirm-title" data-modal-surface="true" onMouseDown={event => event.stopPropagation()}>
              <header><h2 id="admin-webhook-confirm-title">Переподключить webhook?</h2><button type="button" aria-label="Закрыть подтверждение webhook" disabled={telegramSetupBusy} onClick={() => setTelegramReconnectOpen(false)}><X size={20} aria-hidden="true" /></button></header>
              <p>Бот: <strong>@{TELEGRAM_BOT_USERNAME}</strong><br />Окружение: <strong>{environment}</strong><br />Проект: {projectId}<br />Сайт: {host}</p>
              <p>Это изменяющая серверная операция, а не проверка подключения. Если бот используется в другом окружении, его webhook может быть заменён. Обычный выпуск Hosting этого не требует.</p>
              {telegramSetupStatus ? <p role="status">{telegramSetupStatus}</p> : null}
              <footer><button type="button" disabled={telegramSetupBusy} onClick={() => setTelegramReconnectOpen(false)}>Отмена</button><button type="button" disabled={telegramSetupBusy} onClick={connectTelegramBot}>{telegramSetupBusy ? "Переподключаем…" : "Подтвердить переподключение"}</button></footer>
            </section>
          </div> : null}
        </section>
        </details>
      )}
      subtitle="Назначения, доступы и общая библиотека"
      testId="admin-panel-hub"
      title="Админка"
    />
  );
}
