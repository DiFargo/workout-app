/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";
import {
  ChevronRight,
  ClipboardList,
  Dumbbell,
  AlertCircle,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  UserRound,
  UsersRound,
  X
} from "lucide-react";
import styles from "./AdminWorkspace.module.css";

export const ADMIN_WORKSPACE_SECTIONS = [
  {
    id: "overview",
    label: "Обзор",
    description: "Главные административные задачи",
    icon: LayoutDashboard
  },
  {
    id: "users",
    label: "Пользователи и роли",
    description: "Доступы, клиенты и тренеры",
    icon: UsersRound
  },
  {
    id: "programs",
    label: "Базовые программы",
    description: "Общие программы приложения",
    icon: ClipboardList
  },
  {
    id: "exercises",
    label: "Базовые упражнения",
    description: "Общая библиотека упражнений",
    icon: Dumbbell
  },
];

function getSection(sectionId) {
  return ADMIN_WORKSPACE_SECTIONS.find((section) => section.id === sectionId)
    || ADMIN_WORKSPACE_SECTIONS[0];
}

function AdminWorkspaceEmptyState({ section }) {
  const Icon = section.icon;

  return (
    <section className={styles.emptyState} aria-live="polite">
      <span className={styles.emptyIcon} aria-hidden="true">
        <Icon size={26} strokeWidth={1.8} />
      </span>
      <div>
        <h2>{section.label}</h2>
        <p>{section.description}. Раздел будет заполнен подключёнными данными.</p>
      </div>
    </section>
  );
}

function AdminWorkspaceOverview({ onOverviewQueueAction, onSectionChange, overviewQueue, overviewStats }) {
  const overviewSections = ADMIN_WORKSPACE_SECTIONS.filter((section) => section.id !== "overview");
  const visibleStats = Array.isArray(overviewStats)
    ? overviewStats.filter((item) => Number.isFinite(item?.value))
    : [];
  const visibleQueue = Array.isArray(overviewQueue)
    ? overviewQueue.filter((item) => Number(item?.count) > 0)
    : [];

  return (
    <>
      <section className={styles.introCard}>
        <span className={styles.eyebrow}>
          <ShieldCheck size={15} strokeWidth={2} aria-hidden="true" />
          Администрирование
        </span>
        <h2>Рабочее место администратора</h2>
        <p>
          Здесь находятся только системные разделы: пользователи, роли и общие материалы.
          Личные программы и упражнения тренеров остаются в их рабочих местах.
        </p>
      </section>

      {visibleStats.length ? (
        <section className={styles.metricGrid} aria-label="Ключевые показатели">
          {visibleStats.map((item) => {
            const Icon = item.icon;

            return (
              <div className={styles.metricCard} key={item.id}>
                {Icon ? <Icon aria-hidden="true" size={18} strokeWidth={1.9} /> : null}
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            );
          })}
        </section>
      ) : null}

      {visibleQueue.length ? (
        <section className={styles.actionQueue} aria-label="Требуют внимания">
          <header className={styles.queueHeader}>
            <div>
              <p className={styles.eyebrow}>Требует внимания</p>
              <h2>Очередь действий</h2>
            </div>
            <span>{visibleQueue.reduce((total, item) => total + Number(item.count || 0), 0)}</span>
          </header>
          <div className={styles.queueList}>
            {visibleQueue.map((item) => {
              const Icon = item.icon || AlertCircle;
              return (
                <button className={styles.queueRow} key={item.id} type="button" onClick={() => onOverviewQueueAction?.(item)}>
                  <span className={styles.queueIcon} aria-hidden="true"><Icon size={19} strokeWidth={2} /></span>
                  <span className={styles.queueCopy}>
                    <strong>{item.title}</strong>
                    <small>{item.description}</small>
                  </span>
                  <span className={styles.queueCount}>{item.count}</span>
                  <span className={styles.queueAction}>{item.actionLabel || "Открыть"}<ChevronRight size={17} strokeWidth={2} aria-hidden="true" /></span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className={styles.sectionGrid} aria-label="Разделы админки">
        {overviewSections.map((section) => {
          const Icon = section.icon;

          return (
            <button
              className={styles.sectionCard}
              key={section.id}
              type="button"
              onClick={() => onSectionChange?.(section.id)}
            >
              <span className={styles.sectionCardIcon} aria-hidden="true">
                <Icon size={22} strokeWidth={1.9} />
              </span>
              <span className={styles.sectionCardCopy}>
                <strong>{section.label}</strong>
                <small>{section.description}</small>
              </span>
              <ChevronRight className={styles.sectionCardChevron} size={20} strokeWidth={2} aria-hidden="true" />
            </button>
          );
        })}
      </section>
    </>
  );
}

/**
 * A presentation-only administrative workspace shell. Routing and data loading stay
 * outside this component: a parent passes the active section, content, and callbacks.
 */
export default function AdminWorkspace({
  activeSection = "overview",
  adminEmail = "",
  adminMeta = "Администратор",
  adminName = "",
  children,
  className = "",
  headerTitle = "",
  onLogout,
  onOverviewQueueAction,
  onProfileClick,
  onSectionChange,
  overviewQueue,
  overviewStats,
  renderContent,
  subtitle = "Управление доступом и общими материалами",
  title = "Админка",
  testId
}) {
  const [accountOpen, setAccountOpen] = useState(false);
  const activeItem = getSection(activeSection);
  const content = children ?? renderContent?.(activeItem.id);
  const accountName = adminName || "Администратор";
  const accountInitial = String(accountName || adminMeta || "A").trim().slice(0, 1).toLocaleUpperCase("ru");
  const canOpenAccount = typeof onProfileClick === "function" || typeof onLogout === "function";

  const handleSectionChange = (sectionId) => {
    onSectionChange?.(sectionId);
  };

  const closeAccount = () => setAccountOpen(false);
  const openProfile = () => {
    closeAccount();
    onProfileClick?.();
  };
  const logout = () => {
    closeAccount();
    onLogout?.();
  };

  return (
    <div className={`${styles.workspace} ${className}`.trim()} data-testid={testId}>
      <aside className={styles.sidebar} aria-label="Навигация администратора">
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">A</span>
          <span>
            <strong>{title}</strong>
            <small>Панель управления</small>
          </span>
        </div>

        <nav className={styles.desktopNav}>
          {ADMIN_WORKSPACE_SECTIONS.map((section) => {
            const Icon = section.icon;
            const isActive = section.id === activeItem.id;

            return (
              <button
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`.trim()}
                key={section.id}
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => handleSectionChange(section.id)}
              >
                <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
                <span>{section.label}</span>
              </button>
            );
          })}
        </nav>

        {canOpenAccount ? (
          <button
            className={styles.profileButton}
            type="button"
            aria-haspopup="dialog"
            onClick={() => setAccountOpen(true)}
          >
            <span className={styles.profileAvatar} aria-hidden="true">
              {accountInitial}
            </span>
            <span className={styles.profileCopy}>
              <small className={styles.profileEyebrow}>Личный кабинет</small>
              <strong>{accountName}</strong>
              <small>{adminMeta}</small>
            </span>
            <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        ) : null}
      </aside>

      <main className={styles.mainContent}>
        <header className={styles.header}>
          <div>
            <p className={styles.headerEyebrow}>{activeItem.label}</p>
            <h1>{headerTitle || title}</h1>
            <span>{subtitle}</span>
          </div>
          {canOpenAccount ? (
            <button
              className={styles.mobileProfileButton}
              type="button"
              aria-label="Личный кабинет"
              onClick={() => setAccountOpen(true)}
            >
              <UserRound size={21} strokeWidth={1.9} aria-hidden="true" />
            </button>
          ) : null}
        </header>

        <nav className={styles.mobileNav} aria-label="Разделы админки">
          {ADMIN_WORKSPACE_SECTIONS.map((section) => {
            const Icon = section.icon;
            const isActive = section.id === activeItem.id;

            return (
              <button
                className={`${styles.mobileNavItem} ${isActive ? styles.mobileNavItemActive : ""}`.trim()}
                key={section.id}
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => handleSectionChange(section.id)}
              >
                <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
                <span>{section.label}</span>
              </button>
            );
          })}
        </nav>

        <div className={styles.content}>
          {content || (
            activeItem.id === "overview"
              ? <AdminWorkspaceOverview onOverviewQueueAction={onOverviewQueueAction} onSectionChange={handleSectionChange} overviewQueue={overviewQueue} overviewStats={overviewStats} />
              : <AdminWorkspaceEmptyState section={activeItem} />
          )}
        </div>
      </main>

      {accountOpen ? (
        <div className={styles.accountOverlay} role="presentation" onMouseDown={closeAccount}>
          <section
            aria-labelledby="admin-account-title"
            aria-modal="true"
            className={styles.accountSheet}
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className={styles.accountHeader}>
              <div>
                <p>Личный кабинет</p>
                <h2 id="admin-account-title">Аккаунт администратора</h2>
              </div>
              <button className={styles.accountCloseButton} type="button" aria-label="Закрыть" onClick={closeAccount}>
                <X size={22} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </header>

            <div className={styles.accountIdentity}>
              <span className={`${styles.profileAvatar} ${styles.accountAvatar}`.trim()} aria-hidden="true">{accountInitial}</span>
              <span>
                <strong>{accountName}</strong>
                <small>{adminEmail || adminMeta}</small>
              </span>
            </div>

            <div className={styles.accountActions}>
              {typeof onProfileClick === "function" ? (
                <button className={styles.accountSettingsButton} type="button" onClick={openProfile}>
                  <UserRound size={19} strokeWidth={1.9} aria-hidden="true" />
                  <span>Настройки профиля</span>
                  <ChevronRight size={19} strokeWidth={2} aria-hidden="true" />
                </button>
              ) : null}
              {typeof onLogout === "function" ? (
                <button className={styles.logoutButton} type="button" onClick={logout}>
                  <LogOut size={19} strokeWidth={2} aria-hidden="true" />
                  Выйти из аккаунта
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
