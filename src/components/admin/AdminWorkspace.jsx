/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense, useContext, useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  ClipboardList,
  Copy,
  Dumbbell,
  AlertCircle,
  LayoutDashboard,
  KeyRound,
  LogOut,
  MessageSquare,
  UserRound,
  UsersRound,
  X
} from "lucide-react";
import { auth } from "../../firebase";
import { fetchAuthorizedWithTimeout } from "../../utils/apiClient";
import { captureAuthSession } from "../../utils/authSession.js";
import { useModalBackNavigation } from "../../shared/hooks/useModalBackNavigation.js";
import styles from "./AdminWorkspace.module.css";
import { AdminSecurityKeyContext } from "./AdminSecurityKeyContext.js";
const AdminFeedbackInbox = lazy(() => import("./AdminFeedbackInbox.jsx"));

export function getAdminRecoveryAccountLabel(client = {}) {
  const email = String(client.email || "").trim();
  const [local, domain] = email.split("@");
  const maskedEmail = domain ? `${local.slice(0, 2)}***@${domain}` : "Email не указан";
  const id = String(client.id || client.uid || "").trim();
  return `${client.name || "Без имени"} · ${maskedEmail} · ID …${id.slice(-8)}`;
}

export async function requestAdminTelegramRecoveryLink(targetUid, username, request = fetchAuthorizedWithTimeout) {
  const expectedTelegramUsername = String(username || "").trim().replace(/^@/, "").toLowerCase();
  if (!String(targetUid || "").trim() || !/^[a-z0-9_]{5,32}$/.test(expectedTelegramUsername)) {
    throw new Error("Укажите клиента и Telegram-ник: 5–32 символа, латиница, цифры или _.");
  }
  const response = await request("/api/telegram/create-link-code", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetUid, expectedTelegramUsername })
  }, 16000);
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok !== true) {
    throw new Error(response.status === 403
      ? "Нет доступа. Проверьте права администратора и активность клиента."
      : "Не удалось создать ссылку. Проверьте подключение и повторите.");
  }
  let url;
  try { url = new URL(result.botStartUrl); } catch { /* Reject incomplete success responses below. */ }
  if (!result.code || url?.protocol !== "https:" || url?.hostname !== "t.me" ||
      url.searchParams.get("start") !== result.code ||
      url.username || url.password || !(Date.parse(result.expiresAt) > Date.now())) {
    throw new Error("Сервер не вернул действующую ссылку. Повторите создание.");
  }
  return { ...result, expectedTelegramUsername };
}

function AdminTelegramRecoveryDialog({ clients, onClose }) {
  const [targetUid, setTargetUid] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  const client = clients.find(item => item.id === targetUid);
  useModalBackNavigation({ open: true, onBack: () => { if (!busy) onClose(); } });
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    const closeOnEscape = event => { if (event.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [busy, onClose]);

  async function submit(event) {
    event.preventDefault();
    if (pending.current || result || !client) return;
    const session = captureAuthSession(auth);
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const link = await requestAdminTelegramRecoveryLink(client.id, username);
      if (mounted.current && session.isCurrent()) setResult({ ...link, clientName: client.name, clientId: client.id, clientIdentity: getAdminRecoveryAccountLabel(client) });
    } catch (requestError) {
      if (mounted.current && session.isCurrent()) setError(requestError.message || "Не удалось создать ссылку.");
    } finally {
      pending.current = false;
      if (mounted.current && session.isCurrent()) setBusy(false);
    }
  }

  async function copyLink() {
    const session = captureAuthSession(auth);
    if (!(Date.parse(result.expiresAt) > Date.now())) {
      setError("Срок ссылки истёк. Закройте окно и создайте новую ссылку.");
      return;
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard-unavailable");
      await navigator.clipboard.writeText(result.botStartUrl);
      if (mounted.current && session.isCurrent()) { setCopied(true); setError(""); }
    } catch {
      if (mounted.current && session.isCurrent()) setError("Не удалось скопировать. Выделите ссылку ниже и скопируйте вручную.");
    }
  }

  return <div className={styles.accountOverlay} data-modal-backdrop="true" role="presentation" onMouseDown={() => !busy && onClose()}>
    <section className={`${styles.accountSheet} ${styles.recoverySheet}`} role="dialog" aria-modal="true" aria-busy={busy} aria-labelledby="admin-telegram-recovery-title" data-modal-surface="true" onMouseDown={event => event.stopPropagation()}>
      <header className={styles.accountHeader}>
        <div><p>Существующий аккаунт клиента</p><h2 id="admin-telegram-recovery-title">Восстановить вход через Telegram</h2></div>
        <button className={styles.accountCloseButton} type="button" disabled={busy} aria-label="Закрыть восстановление Telegram" onClick={onClose}><X size={22} aria-hidden="true" /></button>
      </header>
      <form className={styles.recoveryForm} onSubmit={submit}>
        {result ? <>
          <p><strong>{result.clientName}</strong><br />{result.clientIdentity}<br /><code>ID: {result.clientId}</code><br />Telegram: @{result.expectedTelegramUsername}</p>
          <p role="status">Одноразовая ссылка готова. Действует до {new Date(result.expiresAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} — не более 10 минут.</p>
          <code className={styles.recoveryLink} data-testid="admin-telegram-recovery-link">{result.botStartUrl}</code>
          <button type="button" className={styles.recoveryPrimary} onClick={copyLink}><Copy size={18} aria-hidden="true" />{copied ? "Ссылка скопирована" : "Скопировать ссылку"}</button>
          <p className={styles.recoveryHelp}>Передайте ссылку только владельцу этого аккаунта. В Telegram ему нужно нажать Start. UID, тренер и данные клиента не меняются.</p>
        </> : <>
          <label>Клиент<select value={targetUid} required disabled={busy} onChange={event => { setTargetUid(event.target.value); setUsername(""); setError(""); }}><option value="">Выберите существующего клиента</option>{clients.map(item => <option key={item.id} value={item.id}>{getAdminRecoveryAccountLabel(item)}</option>)}</select></label>
          {client ? <p className={styles.recoveryTarget}>Восстанавливаем доступ к аккаунту: <strong>{getAdminRecoveryAccountLabel(client)}</strong><br /><code>ID: {client.id}</code></p> : null}
          <label>Telegram владельца<input value={username} onChange={event => { setUsername(event.target.value); setError(""); }} autoComplete="off" autoCapitalize="none" spellCheck="false" placeholder="@username" required disabled={busy} aria-describedby="admin-telegram-recovery-warning" /></label>
          <p id="admin-telegram-recovery-warning" className={styles.recoveryWarning}>Проверьте, что это Telegram владельца. Ссылка даёт доступ к этому аккаунту.</p>
          <p className={styles.recoveryHelp}>Ник нужно указать вручную. Ссылка одноразовая и действует 10 минут. Ничего не отправится автоматически.</p>
          <button className={styles.recoveryPrimary} type="submit" disabled={busy || !client}>{busy ? "Создаём ссылку…" : "Создать одноразовую ссылку"}</button>
        </>}
        {error ? <p className={styles.recoveryError} role="alert">{error}</p> : null}
      </form>
    </section>
  </div>;
}

export const ADMIN_WORKSPACE_SECTIONS = [
  {
    id: "overview",
    label: "Обзор",
    shortLabel: "Обзор",
    description: "Главные административные задачи",
    icon: LayoutDashboard
  },
  {
    id: "users",
    label: "Пользователи и роли",
    shortLabel: "Люди",
    description: "Доступы, клиенты и тренеры",
    icon: UsersRound
  },
  {
    id: "programs",
    label: "Базовые программы",
    shortLabel: "Программы",
    description: "Общие программы приложения",
    icon: ClipboardList
  },
  {
    id: "exercises",
    label: "Базовые упражнения",
    shortLabel: "Упражнения",
    description: "Общая библиотека упражнений",
    icon: Dumbbell
  },
  { id: "feedback", label: "Обратная связь", shortLabel: "Обращения", description: "Сообщения пользователей администратору", icon: MessageSquare },
];

function getSection(sectionId) {
  return ADMIN_WORKSPACE_SECTIONS.find((section) => section.id === sectionId)
    || ADMIN_WORKSPACE_SECTIONS.find(section => section.id === "overview");
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

function AdminWorkspaceOverview({ onOverviewQueueAction, onOverviewStatAction, onSectionChange, overviewQueue, overviewStats }) {
  const overviewSections = ADMIN_WORKSPACE_SECTIONS.filter((section) => section.id !== "overview");
  const visibleStats = Array.isArray(overviewStats)
    ? overviewStats.filter((item) => Number.isFinite(item?.value))
    : [];
  const visibleQueue = Array.isArray(overviewQueue)
    ? overviewQueue.filter((item) => Number(item?.count) > 0)
    : [];

  return (
    <>
      {visibleStats.length ? (
        <section className={styles.metricGrid} aria-label="Ключевые показатели">
          {visibleStats.map((item) => {
            const Icon = item.icon;

            return (
              <button className={styles.metricCard} key={item.id} type="button"
                onClick={() => typeof onOverviewStatAction === "function" ? onOverviewStatAction(item) : onSectionChange?.("users")}
                aria-label={`${item.label}: ${item.value}. Открыть каталог пользователей`}>
                {Icon ? <Icon aria-hidden="true" size={18} strokeWidth={1.9} /> : null}
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </button>
            );
          })}
        </section>
      ) : null}

      {visibleQueue.length ? (
        <section className={styles.actionQueue} aria-label="Требуют внимания">
          <header className={styles.queueHeader}>
            <div>
              <h2>Требуют внимания</h2>
            </div>
            <span aria-label={`Групп задач: ${visibleQueue.length}`}>{visibleQueue.length}</span>
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
      ) : <p className={styles.overviewNotice}>Откройте каталог пользователей, чтобы проверить назначения и доступы. Отсутствие задач здесь не подтверждает состояние всей системы.</p>}

      <section className={styles.sectionGrid} aria-label="Разделы админки" data-testid="admin-overview-sections">
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
  contentLayout = "",
  canRecoverTelegramAccess = false,
  headerTitle = "",
  onLogout,
  onOverviewQueueAction,
  onOverviewStatAction,
  onProfileClick,
  onSectionChange,
  overviewSupplement,
  overviewQueue,
  overviewStats,
  renderContent,
  subtitle = "Управление доступом и общими материалами",
  telegramRecoveryClients = [],
  title = "Админка",
  testId
}) {
  const openSecurityKeys = useContext(AdminSecurityKeyContext);
  const workspaceRef = useRef(null);
  const headerRef = useRef(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  useModalBackNavigation({ open: feedbackOpen, onBack: () => setFeedbackOpen(false) });
  useModalBackNavigation({ open: accountOpen, onBack: () => setAccountOpen(false) });
  useEffect(() => {
    if (!accountOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setAccountOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [accountOpen]);
  const activeItem = getSection(feedbackOpen ? "feedback" : activeSection);
  const content = feedbackOpen ? <Suspense fallback={<p role="status">Загружаем обращения…</p>}><AdminFeedbackInbox /></Suspense> : children ?? renderContent?.(activeItem.id);
  const accountName = adminName || "Администратор";
  const accountInitial = String(accountName || adminMeta || "A").trim().slice(0, 1).toLocaleUpperCase("ru");
  const canOpenAccount = typeof onProfileClick === "function" || typeof onLogout === "function";
  useEffect(() => {
    if (contentLayout !== "client" || !headerRef.current || !workspaceRef.current) return undefined;
    const header = headerRef.current;
    const workspace = workspaceRef.current;
    const measure = () => workspace.style.setProperty("--admin-header-height", `${header.getBoundingClientRect().height}px`);
    measure();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(header);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [contentLayout]);

  const handleSectionChange = (sectionId) => {
    setFeedbackOpen(sectionId === "feedback");
    if (sectionId === "feedback") return;
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
    <div ref={workspaceRef} className={`${styles.workspace}${contentLayout === "client" ? ` ${styles.clientWorkspace}` : ""} ${className}`.trim()} data-testid={testId}>
      <aside className={styles.sidebar} aria-label="Навигация администратора">
        <div className={styles.brand}>
          <img className={styles.brandMark} src="/brand/ownset.svg?v=gradient-1" width="38" height="38" alt="" />
          <span>
            <strong>Zmena</strong>
            <small>{title === "Админка" ? "Кабинет администратора" : title}</small>
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
              <small className={styles.profileActionHint}>Настройки и выход</small>
            </span>
            <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        ) : null}
      </aside>

      <main className={styles.mainContent}>
        <header ref={headerRef} className={styles.header}>
          <div>
            <h1>{feedbackOpen ? "Обратная связь" : headerTitle || (activeItem.id === "overview" ? "Обзор" : activeItem.label)}</h1>
            <span>{feedbackOpen ? "Обращения пользователей и вложения" : subtitle}</span>
          </div>
          {canOpenAccount ? (
            <button
              className={styles.mobileProfileButton}
              type="button"
              aria-label="Аккаунт: настройки и выход"
              onClick={() => setAccountOpen(true)}
            >
              <UserRound size={21} strokeWidth={1.9} aria-hidden="true" />
              <span>Аккаунт</span>
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
                aria-label={section.label}
                onClick={() => handleSectionChange(section.id)}
              >
                <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
                <span>{section.shortLabel}</span>
              </button>
            );
          })}
        </nav>

        <div className={styles.content}>
          {activeItem.id === "users" && canRecoverTelegramAccess && telegramRecoveryClients.length > 0 ? (
            <details className={`${styles.recoveryPanel} ${styles.recoveryDisclosure}`}>
              <summary>Помощь со входом клиента</summary>
              <div><strong>Вход клиента через Telegram</strong><p>Адресное восстановление доступа к существующему аккаунту.</p></div>
              <button type="button" onClick={() => setRecoveryOpen(true)}>Восстановить вход через Telegram</button>
            </details>
          ) : null}
          {content || (
            activeItem.id === "overview"
              ? <>
                  <AdminWorkspaceOverview onOverviewQueueAction={onOverviewQueueAction} onOverviewStatAction={onOverviewStatAction} onSectionChange={handleSectionChange} overviewQueue={overviewQueue} overviewStats={overviewStats} />
                  {overviewSupplement}
                </>
              : <AdminWorkspaceEmptyState section={activeItem} />
          )}
        </div>
      </main>

      {recoveryOpen && activeItem.id === "users" && canRecoverTelegramAccess ? <AdminTelegramRecoveryDialog clients={telegramRecoveryClients} onClose={() => setRecoveryOpen(false)} /> : null}

      {accountOpen ? (
        <div className={styles.accountOverlay} data-modal-backdrop="true" role="presentation" onMouseDown={closeAccount}>
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
              {openSecurityKeys ? <button className={styles.accountSettingsButton} type="button" onClick={() => { closeAccount(); openSecurityKeys(); }}>
                <KeyRound size={19} strokeWidth={1.9} aria-hidden="true" />
                <span>USB/NFC-ключи доступа</span>
                <ChevronRight size={19} strokeWidth={2} aria-hidden="true" />
              </button> : null}
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
