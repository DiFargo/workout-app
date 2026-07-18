import trainerWorkspaceStyles from "../trainer/TrainerWorkspace.module.css";
import "./AdminPanelHub.module.css";
import styles from "./AdminResponsive.module.css";

export default function AdminPanelHub({
  canUseAdminFeatures,
  setPage,
  openAdminProgramsOverview
}) {
  if (!canUseAdminFeatures()) {
    return (
      <div className={`app ${trainerWorkspaceStyles.workspaceRoot}`}>
        <button className={`backBtn ${styles.deniedBack}`} type="button" onClick={() => setPage("main")}>
          ← Главное меню
        </button>
        <div className="historyEmptyCard">
          <h3>Доступ закрыт</h3>
          <p>Админ-панель доступна только главному администратору.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`adminPanelHubPage ${trainerWorkspaceStyles.workspaceRoot}`}>
      <button
        className="adminFixedMainBack"
        type="button"
        onClick={() => setPage("main")}
        aria-label="Главное меню"
      >
        <span>←</span>
        <b>Главное меню</b>
      </button>

      <section className="adminPanelHubHero">
        <span>ADMIN CONTROL</span>
        <h1>Админ-панель</h1>
        <p>Отдельный раздел для управления ролями, клиентами и системными настройками.</p>
      </section>

      <section className="adminPanelHubGrid">
        <button
          type="button"
          className="adminPanelHubCard"
          onClick={() => setPage("adminUsers")}
        >
          <i>👥</i>
          <strong>Клиенты и роли</strong>
          <small>Назначение тренеров, карточки клиентов, доступы.</small>
        </button>

        <button
          type="button"
          className="adminPanelHubCard"
          onClick={openAdminProgramsOverview}
        >
          <i>🧩</i>
          <strong>Программы</strong>
          <small>Библиотека программ и назначение тренировок.</small>
        </button>

        <button
          type="button"
          className="adminPanelHubCard"
          onClick={() => setPage("admin")}
        >
          <i>📝</i>
          <strong>Тренерская CRM</strong>
          <small>Обзор, статистика, управление тренерами.</small>
        </button>
      </section>
    </div>
  );
}
