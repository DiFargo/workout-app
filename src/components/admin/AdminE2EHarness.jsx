import { useState } from "react";
import "./AdminE2EHarness.module.css";
import trainerWorkspaceStyles from "../trainer/TrainerWorkspace.module.css";
import TrainerAdminCalendarTab from "../../features/trainer/TrainerAdminCalendarTab";
import AdminPanelHub from "./AdminPanelHub";

const harnessClients = [
  {
    id: "admin_harness_client_1",
    name: "Harness Client",
    email: "client@example.com",
    goal: "recomp",
    status: "active",
    program: 64,
    nutritionDays: 6,
    calories: 2210
  },
  {
    id: "admin_harness_client_2",
    name: "Review Client",
    email: "review@example.com",
    goal: "fat_loss",
    status: "attention",
    program: 28,
    nutritionDays: 3,
    calories: 1840
  }
];

const adminCalendarDays = [
  { id: "monday", title: "Пн", full: "Понедельник" },
  { id: "tuesday", title: "Вт", full: "Вторник" },
  { id: "wednesday", title: "Ср", full: "Среда" },
  { id: "thursday", title: "Чт", full: "Четверг" },
  { id: "friday", title: "Пт", full: "Пятница" },
  { id: "saturday", title: "Сб", full: "Суббота" },
  { id: "sunday", title: "Вс", full: "Воскресенье" }
];

const adminCalendarInitialDraft = {
  enabled: true,
  reminderEnabled: true,
  workoutTime: "13:00",
  trainingDays: ["monday", "wednesday", "friday"],
  daySettings: {
    monday: { workoutTime: "13:00", reminderBefore: "1 день", hourReminderEnabled: true },
    wednesday: { workoutTime: "18:00", reminderBefore: "2 дня", hourReminderEnabled: false },
    friday: { workoutTime: "12:30", reminderBefore: "1 день", hourReminderEnabled: true }
  }
};

function getAdminHarnessAccess() {
  if (typeof window === "undefined") return true;
  return new URLSearchParams(window.location.search).get("adminAccess") !== "denied";
}

function getAdminHarnessSurface() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("adminSurface") || "";
}

function AdminUsersHarnessSurface({ onAction }) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(harnessClients[0].id);
  const selectedClient = harnessClients.find((client) => client.id === selectedId) || harnessClients[0];

  return (
    <div className={`adminUsersCrmPage adminHarnessCrmSurface ${trainerWorkspaceStyles.workspaceRoot}`} data-testid="admin-users-harness">
      <main className="adminUsersCrmMain adminUsersCrmMainClientPage">
        <header className="adminUsersCrmHeader">
          <div>
            <span>CLIENT MANAGEMENT</span>
            <h1>Clients</h1>
            <p>Harness coverage for list, search, client cards and workspace tabs.</p>
          </div>
        </header>

        <section className="adminUsersFilterPills" aria-label="Client filter">
          {["All", "Active", "Attention"].map((label, index) => (
            <button key={label} type="button" className={index === 0 ? "active" : ""} aria-pressed={index === 0}>
              {label}
            </button>
          ))}
        </section>

        <section className="adminUsersCrmGrid adminUsersCrmGridCardsOnly">
          <div className="adminUsersClientsPanel adminUsersClientsPanelFull">
            <div className="adminUsersToolbar">
              <div>
                <h2>Client cards</h2>
                <p>{harnessClients.length} clients</p>
              </div>
              <div className="adminUsersToolbarActions">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search client..."
                />
              </div>
            </div>

            <div className="adminClientCardsGrid adminClientCardsGridFive">
              {harnessClients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  className={selectedId === client.id ? "adminClientCard adminClientCardRect adminClientCardWide active" : "adminClientCard adminClientCardRect adminClientCardWide"}
                  aria-pressed={selectedId === client.id}
                  onClick={() => setSelectedId(client.id)}
                >
                  <span className="adminClientAvatar">HC</span>
                  <div className="adminClientCardMain">
                    <span className="trainerClientNameRow">
                      <strong>{client.name}</strong>
                      <span className={`trainerClientStatusBadge ${client.status}`}>{client.status}</span>
                    </span>
                    <small>{client.email}</small>
                  </div>
                  <em>{client.goal}</em>
                  <span className="trainerClientMiniStats adminClientSummaryStats">
                    <span>Program {client.program}%</span>
                    <span>Nutrition {client.nutritionDays}/7 · {client.calories} kcal</span>
                    <span>Measurement today</span>
                  </span>
                  <div className="adminClientCardBottom">
                    <i>{selectedId === client.id ? "Open" : "Open client"}</i>
                    <b>client</b>
                  </div>
                </button>
              ))}

              <button
                type="button"
                className="adminClientCard adminClientCardRect adminClientAddCard"
                onClick={() => onAction("create-client")}
              >
                <span className="adminClientAddIcon">+</span>
                <div>
                  <strong>Add client</strong>
                  <small>Create login and password</small>
                </div>
                <em>New client</em>
                <i>Create</i>
              </button>
            </div>
          </div>
        </section>

        <section className="adminClientWorkspaceCrm adminClientWorkspaceCrmPage">
          <header className="adminClientWorkspaceHeaderRender trainerClientHero">
            <div className="adminClientIdentityRender">
              <span className="adminClientInitialsRender">HC</span>
              <div>
                <span>SELECTED CLIENT</span>
                <h2>{selectedClient.name}</h2>
                <p>{selectedClient.email} · assigned trainer · Telegram connected</p>
              </div>
            </div>
            <div className="adminClientWorkspaceActionsRender">
              <button type="button" onClick={() => onAction("message")}>Message</button>
              <button type="button" onClick={() => onAction("assign")}>Assign</button>
              <button type="button" className="danger" onClick={() => onAction("pause")}>Pause</button>
            </div>
          </header>

          <nav className="adminClientTabsCrm" aria-label="Client workspace tabs">
            {["Overview", "Training", "Nutrition", "Telegram"].map((label, index) => (
              <button key={label} type="button" className={index === 0 ? "active" : ""} aria-pressed={index === 0}>{label}</button>
            ))}
          </nav>

          <div className="adminClientMetricGridRender">
            <article className="adminClientMetricCardRender"><i>W</i><span>Workouts</span><strong>4/8</strong><em>This month</em></article>
            <article className="adminClientMetricCardRender"><i>N</i><span>Nutrition</span><strong>{selectedClient.nutritionDays}/7</strong><em>Tracked days</em></article>
            <article className="adminClientMetricCardWideRender"><i>P</i><span>Program</span><strong>{selectedClient.program}%</strong><em>Completion</em></article>
          </div>
        </section>
      </main>
    </div>
  );
}

function AdminProgramsHarnessSurface({ onAction }) {
  return (
    <div className={`monthProgramEditorPage monthProgramPremium monthProgramOverviewMode ${trainerWorkspaceStyles.workspaceRoot}`} data-testid="admin-programs-harness">
      <header className="programsCompactHeader">
        <button className="adminFixedMainBack" type="button" onClick={() => onAction("programs-back")}>
          <span>←</span>
          <b>Back</b>
        </button>
        <h1>Programs</h1>
      </header>

      <section className="programsOverviewSection">
        <div className="programsOverviewGrid">
          {["Strength Base", "Fat Loss", "Hypertrophy"].map((name, index) => (
            <button
              key={name}
              type="button"
              className={index === 0 ? "programsOverviewCard selected" : "programsOverviewCard"}
              aria-pressed={index === 0}
              onClick={() => onAction(`program:${name}`)}
            >
              <div className="programsOverviewCardTitle">
                <i>{index + 1}</i>
                <div>
                  <strong>{name}</strong>
                  <p>4 weeks · 8 workouts</p>
                </div>
                <span><b>{index === 0 ? "Active" : "Template"}</b></span>
              </div>
              <p>Harness program card with stats and stable actions.</p>
              <div className="programsOverviewCardStats">
                <span><b>2</b><small>Microcycles</small></span>
                <span><b>8</b><small>Days</small></span>
              </div>
              <footer>
                <b>Open editor</b>
                <span>Assign</span>
              </footer>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function AdminCalendarHarnessSurface({ onAction }) {
  const [draft, setDraft] = useState(adminCalendarInitialDraft);
  const selectedClient = {
    id: "admin_harness_client_1",
    name: "Harness Client",
    telegram: { connected: true }
  };

  function toggleDay(dayId) {
    setDraft((current) => {
      const trainingDays = Array.isArray(current.trainingDays) ? current.trainingDays : [];
      const nextDays = trainingDays.includes(dayId)
        ? trainingDays.filter((item) => item !== dayId)
        : [...trainingDays, dayId];

      return { ...current, trainingDays: nextDays };
    });
  }

  function updateDaySetting(dayId, key, value) {
    setDraft((current) => ({
      ...current,
      daySettings: {
        ...(current.daySettings || {}),
        [dayId]: {
          ...(current.daySettings?.[dayId] || {}),
          [key]: value
        }
      }
    }));
  }

  return (
    <main className={`adminUsersCrmPage adminHarnessCrmSurface ${trainerWorkspaceStyles.workspaceRoot}`} data-testid="admin-calendar-harness">
      <TrainerAdminCalendarTab
        adminCalendarDays={adminCalendarDays}
        adminCalendarDraft={draft}
        adminCalendarSaving={false}
        adminCalendarTesting={false}
        getClientTelegramProfile={() => ({ connected: true })}
        saveAdminClientCalendar={() => onAction("calendar-save")}
        selectedClient={selectedClient}
        sendAdminTestWorkoutReminder={() => onAction("calendar-test")}
        setAdminCalendarDraft={setDraft}
        toggleAdminCalendarDay={toggleDay}
        updateAdminCalendarDaySetting={updateDaySetting}
      />
      <output hidden data-testid="admin-calendar-days">{draft.trainingDays.join(",")}</output>
    </main>
  );
}

export default function AdminE2EHarness() {
  const [lastAction, setLastAction] = useState("idle");
  const canAccessAdmin = getAdminHarnessAccess();
  const surface = getAdminHarnessSurface();

  if (surface === "users") {
    return (
      <main className={trainerWorkspaceStyles.workspaceRoot} data-testid="admin-harness-root">
        <AdminUsersHarnessSurface onAction={setLastAction} />
        <output data-testid="admin-harness-action">{lastAction}</output>
      </main>
    );
  }

  if (surface === "programs") {
    return (
      <main className={trainerWorkspaceStyles.workspaceRoot} data-testid="admin-harness-root">
        <AdminProgramsHarnessSurface onAction={setLastAction} />
        <output data-testid="admin-harness-action">{lastAction}</output>
      </main>
    );
  }

  if (surface === "calendar") {
    return (
      <main className={trainerWorkspaceStyles.workspaceRoot} data-testid="admin-harness-root">
        <AdminCalendarHarnessSurface onAction={setLastAction} />
        <output data-testid="admin-harness-action">{lastAction}</output>
      </main>
    );
  }

  return (
    <main className={trainerWorkspaceStyles.workspaceRoot} data-testid="admin-harness-root">
      <AdminPanelHub
        canUseAdminFeatures={() => canAccessAdmin}
        setPage={(page) => setLastAction(`page:${page}`)}
        openAdminProgramsOverview={() => setLastAction("programs")}
      />
      <output data-testid="admin-harness-action">{lastAction}</output>
    </main>
  );
}
