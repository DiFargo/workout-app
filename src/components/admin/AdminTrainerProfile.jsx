import { useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  BookOpen,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  Ellipsis,
  GraduationCap,
  KeyRound,
  LibraryBig,
  Mail,
  MessageCircle,
  ShieldCheck,
  SlidersHorizontal,
  UsersRound,
  X
} from "lucide-react";
import styles from "./AdminTrainerProfile.module.css";

const EMPTY_LIST = [];

function getRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function getText(...values) {
  for (const value of values) {
    if (value === null || value === undefined || typeof value === "boolean") continue;
    const text = String(value).trim();
    if (text) return text;
  }

  return "";
}

function getCount(...values) {
  for (const value of values) {
    const count = Number(value);
    if (Number.isFinite(count) && count >= 0) return Math.round(count);
  }

  return 0;
}

function pluralize(count, forms) {
  const value = Math.abs(Number(count) || 0);
  const remainder = value % 100;
  const lastDigit = value % 10;

  if (remainder > 10 && remainder < 20) return forms[2];
  if (lastDigit === 1) return forms[0];
  if (lastDigit > 1 && lastDigit < 5) return forms[1];
  return forms[2];
}

function formatCount(count, forms) {
  return `${count} ${pluralize(count, forms)}`;
}

function getInitials(name) {
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return words.map((word) => word[0]?.toLocaleUpperCase("ru")).join("") || "Т";
}

function normalizeClient(client, index) {
  const record = getRecord(client);
  const name = getText(record.name, record.fullName, record.displayName, record.clientName) || `Клиент ${index + 1}`;
  const note = getText(record.note, record.statusLabel, record.task, record.planStatus);

  return {
    id: record.id ?? record.uid ?? `${name}-${index}`,
    name,
    note,
    avatarUrl: getText(record.avatarUrl, record.photoURL, record.photoUrl),
    initials: getInitials(name)
  };
}

/**
 * Admin-only presentation component for managing one trainer.
 *
 * The component is intentionally independent from client-profile data: the admin
 * sees account, access, assigned clients and the trainer's own work materials.
 * Callbacks are optional so the parent keeps all Firebase mutations and confirms
 * any sensitive action itself.
 */
export default function AdminTrainerProfile({
  trainer = {},
  clients = EMPTY_LIST,
  counts = {},
  onBack,
  onOpenClients,
  onOpenPrograms,
  onOpenLibrary,
  onOpenMessages,
  onOpenNotifications,
  onOpenAccount,
  onChangeRole,
  onDemoteWithReassignment,
  onToggleAccess,
  onReassignClients,
  onResendInvite,
  onRevokeInvite,
  replacementTrainers = EMPTY_LIST,
  onOpenActions
}) {
  const trainerRecord = getRecord(trainer);
  const countRecord = getRecord(counts);
  const trainerName = getText(
    trainerRecord.name,
    trainerRecord.fullName,
    trainerRecord.displayName,
    trainerRecord.trainerName
  ) || "Тренер";
  const trainerEmail = getText(trainerRecord.email, trainerRecord.login, trainerRecord.emailAddress);
  const trainerAvatar = getText(trainerRecord.avatarUrl, trainerRecord.photoURL, trainerRecord.photoUrl);
  const trainerStatus = getText(trainerRecord.accountStatus, trainerRecord.status).toLocaleLowerCase("ru");
  const isSuspended = Boolean(trainerRecord.accessDisabled) || ["suspended", "blocked", "disabled", "inactive", "приостановлен", "заблокирован"].includes(trainerStatus);
  const isPendingInvite = ["invited", "pending", "created", "ожидает", "приглашён"].includes(trainerStatus);
  const isRevokedInvite = ["revoked", "cancelled", "canceled", "отозван"].includes(trainerStatus);
  const statusLabel = isSuspended
    ? "Доступ приостановлен"
    : isRevokedInvite
      ? "Приглашение отозвано"
      : isPendingInvite
        ? "Ожидает активации"
        : "Активен";
  const safeClients = Array.isArray(clients) ? clients.map(normalizeClient) : EMPTY_LIST;
  const assignedClientsCount = getCount(countRecord.assignedClients, safeClients.length);
  const programsKnown = countRecord.programsKnown !== false;
  const libraryKnown = countRecord.libraryKnown !== false;
  const programsCount = getCount(countRecord.programs);
  const libraryCount = getCount(countRecord.libraryExercises);
  const unreadMessages = getCount(countRecord.unreadMessages, trainerRecord.unreadMessagesCount);
  const joinedLabel = getText(trainerRecord.joinedLabel, trainerRecord.createdLabel, trainerRecord.joinedAtLabel);
  const assignmentsKnown = countRecord.assignmentsKnown !== false;
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleChangePending, setRoleChangePending] = useState(false);
  const [roleChangeError, setRoleChangeError] = useState("");
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [accessChangePending, setAccessChangePending] = useState(false);
  const [accessChangeError, setAccessChangeError] = useState("");
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [reassignPending, setReassignPending] = useState(false);
  const [reassignError, setReassignError] = useState("");
  const [selectedReplacementId, setSelectedReplacementId] = useState("");
  const [invitePending, setInvitePending] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");
  const hasAssignedClients = assignmentsKnown && assignedClientsCount > 0;
  const safeReplacementTrainers = Array.isArray(replacementTrainers) ? replacementTrainers : EMPTY_LIST;

  const requestRoleChange = () => {
    setRoleChangeError("");
    setRoleDialogOpen(true);
  };

  const closeRoleDialog = () => {
    if (roleChangePending) return;
    setRoleDialogOpen(false);
    setRoleChangeError("");
  };

  const confirmRoleChange = async () => {
    if (roleChangePending || hasAssignedClients || !assignmentsKnown || typeof onChangeRole !== "function") {
      return;
    }

    setRoleChangePending(true);
    setRoleChangeError("");

    try {
      await onChangeRole();
      setRoleDialogOpen(false);
    } catch (error) {
      console.error("Admin trainer role downgrade error:", error);
      setRoleChangeError("Не удалось изменить роль. Проверьте подключение и попробуйте ещё раз.");
    } finally {
      setRoleChangePending(false);
    }
  };

  const requestAccessChange = () => {
    setAccessChangeError("");
    setAccessDialogOpen(true);
  };

  const closeAccessDialog = () => {
    if (accessChangePending) return;
    setAccessDialogOpen(false);
    setAccessChangeError("");
  };

  const confirmAccessChange = async () => {
    if (accessChangePending || typeof onToggleAccess !== "function") return;

    setAccessChangePending(true);
    setAccessChangeError("");

    try {
      await onToggleAccess({ action: isSuspended ? "restore" : "suspend" });
      setAccessDialogOpen(false);
    } catch (error) {
      console.error("Admin trainer access change error:", error);
      setAccessChangeError(
        hasAssignedClients && !isSuspended
          ? "Сначала переназначьте клиентов другому активному тренеру, затем повторите действие."
          : "Не удалось изменить доступ. Проверьте подключение и попробуйте ещё раз."
      );
    } finally {
      setAccessChangePending(false);
    }
  };

  const openReassignDialog = () => {
    const firstTrainer = safeReplacementTrainers[0];
    setSelectedReplacementId(String(firstTrainer?.id || firstTrainer?.uid || "").trim());
    setReassignError("");
    setReassignDialogOpen(true);
  };

  const closeReassignDialog = () => {
    if (reassignPending) return;
    setReassignDialogOpen(false);
    setReassignError("");
  };

  const confirmReassignClients = async () => {
    if (reassignPending || !selectedReplacementId || typeof onReassignClients !== "function") return;

    setReassignPending(true);
    setReassignError("");

    try {
      await onReassignClients(selectedReplacementId);
      setReassignDialogOpen(false);
    } catch (error) {
      console.error("Admin trainer client reassignment error:", error);
      setReassignError(error?.reassignedCount
        ? `Переназначены: ${error.reassignedCount}. Осталось: ${error.remainingCount || 0}. Повторите действие для оставшихся клиентов.`
        : "Не удалось переназначить клиентов. Проверьте подключение и попробуйте ещё раз.");
    } finally {
      setReassignPending(false);
    }
  };

  const confirmDemoteWithReassignment = async () => {
    if (reassignPending || !selectedReplacementId || typeof onDemoteWithReassignment !== "function") return;

    setReassignPending(true);
    setReassignError("");

    try {
      await onDemoteWithReassignment(selectedReplacementId);
      setReassignDialogOpen(false);
      setRoleDialogOpen(false);
    } catch (error) {
      console.error("Admin trainer reassignment and demotion error:", error);
      setReassignError("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u0435\u0440\u0435\u0434\u0430\u0442\u044c \u043a\u043b\u0438\u0435\u043d\u0442\u043e\u0432 \u0438 \u0441\u043d\u044f\u0442\u044c \u0440\u043e\u043b\u044c. \u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0435 \u0435\u0449\u0451 \u0440\u0430\u0437.");
    } finally {
      setReassignPending(false);
    }
  };

  const runInviteAction = async (action) => {
    const callback = action === "resend" ? onResendInvite : onRevokeInvite;
    if (invitePending || typeof callback !== "function") return;

    setInvitePending(true);
    setInviteMessage("");

    try {
      const result = await callback();
      const shareUrl = String(result?.invite?.shareUrl || result?.shareUrl || "").trim();
      setInviteMessage(
        action === "resend"
          ? (shareUrl ? "Новое приглашение подготовлено. Ссылка скопирована в буфер обмена." : "Приглашение отправлено повторно.")
          : "Приглашение отозвано. Активировать аккаунт по старой ссылке больше нельзя."
      );
    } catch (error) {
      console.error("Admin trainer invite action error:", error);
      setInviteMessage(action === "resend" ? "Не удалось отправить приглашение повторно." : "Не удалось отозвать приглашение.");
    } finally {
      setInvitePending(false);
    }
  };

  return (
    <main className={styles.root} data-testid="admin-trainer-profile">
      <header className={styles.header}>
        <button className={styles.backButton} type="button" onClick={onBack} aria-label="Вернуться к списку тренеров">
          <ArrowLeft aria-hidden="true" />
          <span>К тренерам</span>
        </button>

        <div className={styles.headerActions} aria-label="Действия с тренером">
          {typeof onOpenMessages === "function" ? (
            <button className={styles.iconAction} type="button" onClick={onOpenMessages}>
              <MessageCircle aria-hidden="true" />
              <span>Сообщения</span>
              {unreadMessages > 0 ? <b>{unreadMessages}</b> : null}
            </button>
          ) : null}
          {typeof onOpenNotifications === "function" ? (
            <button className={styles.iconAction} type="button" onClick={onOpenNotifications}>
              <Bell aria-hidden="true" />
              <span>Уведомления</span>
            </button>
          ) : null}
          {typeof onOpenActions === "function" ? (
            <button className={styles.iconOnlyAction} type="button" onClick={onOpenActions} aria-label="Дополнительные действия">
              <Ellipsis aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </header>

      <section className={styles.profileCard} aria-label={`Карточка тренера ${trainerName}`}>
        <div className={styles.identityBlock}>
          <div className={styles.avatar} aria-hidden="true">
            {trainerAvatar ? <img src={trainerAvatar} alt="" /> : <span>{getInitials(trainerName)}</span>}
          </div>
          <div className={styles.identityCopy}>
            <div className={styles.nameLine}>
              <h1>{trainerName}</h1>
              <span className={styles.roleBadge}><GraduationCap aria-hidden="true" />Тренер</span>
            </div>
            {trainerEmail ? <p className={styles.email}><Mail aria-hidden="true" />{trainerEmail}</p> : null}
            <div className={styles.statusLine}>
              <span className={`${styles.statusBadge}${isSuspended ? ` ${styles.statusSuspended}` : isPendingInvite || isRevokedInvite ? ` ${styles.statusPending}` : ""}`}>
                <span aria-hidden="true" />{statusLabel}
              </span>
              {joinedLabel ? <span className={styles.joinedLabel}>{joinedLabel}</span> : null}
            </div>
          </div>
        </div>

        <div className={styles.profileQuickActions}>
          {typeof onOpenClients === "function" ? (
            <button className={styles.primaryAction} type="button" onClick={onOpenClients}>
              <UsersRound aria-hidden="true" />
              <span>Клиенты тренера</span>
            </button>
          ) : null}
          {typeof onOpenAccount === "function" ? (
            <button className={styles.secondaryAction} type="button" onClick={onOpenAccount}>
              <SlidersHorizontal aria-hidden="true" />
              <span>Настроить доступ</span>
            </button>
          ) : null}
        </div>
      </section>

      {isPendingInvite || isRevokedInvite ? (
        <section className={styles.inviteCard} aria-live="polite">
          <span className={styles.inviteIcon} aria-hidden="true"><Mail /></span>
          <div>
            <p className={styles.eyebrow}>Приглашение тренера</p>
            <strong>{isRevokedInvite ? "Приглашение не активно" : "Ожидаем активацию аккаунта"}</strong>
            <p>{isRevokedInvite ? "Повторная отправка создаст новую ссылку для активации." : "Можно отправить новую ссылку или отозвать приглашение до активации."}</p>
            {inviteMessage ? <small className={styles.inviteMessage} role="status">{inviteMessage}</small> : null}
          </div>
          <div className={styles.inviteActions}>
            {typeof onResendInvite === "function" ? (
              <button className={styles.compactAction} type="button" onClick={() => runInviteAction("resend")} disabled={invitePending}>
                {invitePending ? "Отправляем…" : "Отправить повторно"}
              </button>
            ) : null}
            {isPendingInvite && typeof onRevokeInvite === "function" ? (
              <button className={`${styles.compactAction} ${styles.warningAction}`} type="button" onClick={() => runInviteAction("revoke")} disabled={invitePending}>
                Отозвать
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className={styles.metricsGrid} aria-label="Краткая статистика тренера">
        <MetricCard icon={<UsersRound aria-hidden="true" />} value={assignmentsKnown ? assignedClientsCount : null} label="назначенных клиентов" accent="lavender" />
        <MetricCard icon={<ClipboardList aria-hidden="true" />} value={programsKnown ? programsCount : null} label="личных программ" accent="lavender" />
        <MetricCard icon={<LibraryBig aria-hidden="true" />} value={libraryKnown ? libraryCount : null} label="упражнений в библиотеке" accent="lavender" />
      </section>

      <section className={styles.workGrid} aria-label="Управление тренером">
        <article className={`${styles.managementCard} ${styles.clientsCard}`}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon} aria-hidden="true"><UsersRound /></span>
            <div>
              <p className={styles.eyebrow}>Клиенты</p>
              <h2>Назначенные клиенты</h2>
            </div>
            <span className={styles.cardCount}>{assignmentsKnown ? formatCount(assignedClientsCount, ["клиент", "клиента", "клиентов"]) : "Нет данных"}</span>
          </div>

          {!assignmentsKnown ? (
            <p className={styles.emptyClients}>Не удалось загрузить назначения. Смена роли недоступна, пока данные не будут проверены.</p>
          ) : safeClients.length ? (
            <ul className={styles.clientList}>
              {safeClients.slice(0, 3).map((client) => (
                <li key={client.id}>
                  <span className={styles.clientAvatar} aria-hidden="true">
                    {client.avatarUrl ? <img src={client.avatarUrl} alt="" /> : client.initials}
                  </span>
                  <span className={styles.clientCopy}>
                    <strong>{client.name}</strong>
                    <small>{client.note || "Назначен тренеру"}</small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.emptyClients}>К тренеру пока не назначены клиенты.</p>
          )}

          {typeof onOpenClients === "function" ? (
            <button className={styles.cardLink} type="button" onClick={onOpenClients}>
              <span>{safeClients.length > 3 ? "Все клиенты" : "Управлять клиентами"}</span>
              <ChevronRight aria-hidden="true" />
            </button>
          ) : null}
        </article>

        <article className={styles.managementCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon} aria-hidden="true"><Dumbbell /></span>
            <div>
              <p className={styles.eyebrow}>Рабочие материалы</p>
              <h2>Программы и библиотека</h2>
            </div>
          </div>
          <p className={styles.cardDescription}>
            Личные шаблоны программ и упражнения тренера. Они не смешиваются с общей базой администратора.
          </p>
          <div className={styles.materialStats}>
            <span><ClipboardList aria-hidden="true" /><b>{programsKnown ? programsCount : "—"}</b> программ</span>
            <span><LibraryBig aria-hidden="true" /><b>{libraryKnown ? libraryCount : "—"}</b> упражнений</span>
          </div>
          <div className={styles.cardActions}>
            {typeof onOpenPrograms === "function" ? (
              <button className={styles.compactAction} type="button" onClick={onOpenPrograms}>
                <BookOpen aria-hidden="true" />Программы
              </button>
            ) : null}
            {typeof onOpenLibrary === "function" ? (
              <button className={styles.compactAction} type="button" onClick={onOpenLibrary}>
                <LibraryBig aria-hidden="true" />Библиотека
              </button>
            ) : null}
          </div>
        </article>

        <article className={`${styles.managementCard} ${styles.accessCard}`}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon} aria-hidden="true"><ShieldCheck /></span>
            <div>
              <p className={styles.eyebrow}>Учётная запись</p>
              <h2>Доступ и роль</h2>
            </div>
          </div>
          <div className={styles.accountRows}>
            <div>
              <span>Роль</span>
              <strong>Тренер</strong>
            </div>
            <div>
              <span>Статус</span>
              <strong className={isSuspended ? styles.dangerText : isPendingInvite || isRevokedInvite ? styles.pendingText : styles.successText}>{statusLabel}</strong>
            </div>
          </div>
          <p className={styles.accessHint}>Изменение роли и доступа влияет на все рабочие разделы этого пользователя.</p>
          <div className={styles.cardActions}>
            {typeof onChangeRole === "function" ? (
              <button className={styles.compactAction} type="button" onClick={requestRoleChange}>
                <KeyRound aria-hidden="true" />Изменить роль
              </button>
            ) : null}
            {typeof onToggleAccess === "function" ? (
              <button className={`${styles.compactAction} ${isSuspended ? styles.restoreAction : styles.warningAction}`} type="button" onClick={requestAccessChange}>
                <BadgeCheck aria-hidden="true" />{isSuspended ? "Вернуть доступ" : "Приостановить"}
              </button>
            ) : null}
            {hasAssignedClients && typeof onReassignClients === "function" ? (
              <button className={`${styles.compactAction} ${styles.reassignAction}`} type="button" onClick={openReassignDialog}>
                <UsersRound aria-hidden="true" />Переназначить клиентов
              </button>
            ) : null}
          </div>
        </article>
      </section>

      {roleDialogOpen ? (
        <div className={styles.roleDialogOverlay} role="presentation" onMouseDown={closeRoleDialog}>
          <section
            aria-describedby="admin-trainer-role-dialog-description"
            aria-labelledby="admin-trainer-role-dialog-title"
            aria-modal="true"
            className={styles.roleDialog}
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className={styles.roleDialogClose} type="button" onClick={closeRoleDialog} aria-label="Закрыть" disabled={roleChangePending}>
              <X aria-hidden="true" />
            </button>
            <span className={styles.roleDialogIcon} aria-hidden="true"><KeyRound /></span>
            <p className={styles.eyebrow}>Изменение доступа</p>
            <h2 id="admin-trainer-role-dialog-title">Снять роль тренера?</h2>
            {hasAssignedClients ? (
              <p id="admin-trainer-role-dialog-description">
                Сначала переназначьте {formatCount(assignedClientsCount, ["клиента", "клиентов", "клиентов"])} другому тренеру. Доступ и данные не будут изменены.
              </p>
            ) : !assignmentsKnown ? (
              <p id="admin-trainer-role-dialog-description">
                Не удалось проверить назначенных клиентов. Для безопасности смена роли сейчас недоступна.
              </p>
            ) : (
              <p id="admin-trainer-role-dialog-description">
                Аккаунт потеряет доступ к тренерским разделам. Программы и данные клиентов не удаляются.
              </p>
            )}
            {roleChangeError ? <p className={styles.roleDialogError} role="alert">{roleChangeError}</p> : null}
            <div className={styles.roleDialogActions}>
              <button className={styles.roleDialogCancel} type="button" onClick={closeRoleDialog} disabled={roleChangePending}>
                {hasAssignedClients || !assignmentsKnown ? "Понятно" : "Отмена"}
              </button>
              {!hasAssignedClients && assignmentsKnown ? (
                <button className={styles.roleDialogConfirm} type="button" onClick={confirmRoleChange} disabled={roleChangePending}>
                  {roleChangePending ? "Изменяем…" : "Снять роль тренера"}
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {accessDialogOpen ? (
        <div className={styles.roleDialogOverlay} role="presentation" onMouseDown={closeAccessDialog}>
          <section
            aria-describedby="admin-trainer-access-dialog-description"
            aria-labelledby="admin-trainer-access-dialog-title"
            aria-modal="true"
            className={styles.roleDialog}
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className={styles.roleDialogClose} type="button" onClick={closeAccessDialog} aria-label="Закрыть" disabled={accessChangePending}>
              <X aria-hidden="true" />
            </button>
            <span className={styles.roleDialogIcon} aria-hidden="true"><ShieldCheck /></span>
            <p className={styles.eyebrow}>Управление доступом</p>
            <h2 id="admin-trainer-access-dialog-title">{isSuspended ? "Вернуть доступ тренеру?" : "Приостановить доступ тренера?"}</h2>
            <p id="admin-trainer-access-dialog-description">
              {isSuspended
                ? "Тренер снова сможет работать со своими клиентами, программами и библиотекой."
                : hasAssignedClients
                  ? "У тренера есть назначенные клиенты. Сначала переназначьте их активному тренеру, затем подтвердите приостановку доступа."
                  : "Тренер потеряет доступ к рабочему кабинету. Данные и материалы останутся в системе."}
            </p>
            {accessChangeError ? <p className={styles.roleDialogError} role="alert">{accessChangeError}</p> : null}
            <div className={styles.roleDialogActions}>
              <button className={styles.roleDialogCancel} type="button" onClick={closeAccessDialog} disabled={accessChangePending}>Отмена</button>
              <button className={styles.roleDialogConfirm} type="button" onClick={confirmAccessChange} disabled={accessChangePending || (!isSuspended && hasAssignedClients)}>
                {accessChangePending ? "Сохраняем…" : isSuspended ? "Вернуть доступ" : "Приостановить доступ"}
              </button>
            </div>
            {!isSuspended && hasAssignedClients && typeof onReassignClients === "function" ? (
              <button className={styles.dialogInlineAction} type="button" onClick={() => { closeAccessDialog(); openReassignDialog(); }} disabled={accessChangePending}>
                Переназначить клиентов
              </button>
            ) : null}
          </section>
        </div>
      ) : null}

      {reassignDialogOpen ? (
        <div className={styles.roleDialogOverlay} role="presentation" onMouseDown={closeReassignDialog}>
          <section
            aria-describedby="admin-trainer-reassign-dialog-description"
            aria-labelledby="admin-trainer-reassign-dialog-title"
            aria-modal="true"
            className={styles.roleDialog}
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className={styles.roleDialogClose} type="button" onClick={closeReassignDialog} aria-label="Закрыть" disabled={reassignPending}>
              <X aria-hidden="true" />
            </button>
            <span className={styles.roleDialogIcon} aria-hidden="true"><UsersRound /></span>
            <p className={styles.eyebrow}>Назначения клиентов</p>
            <h2 id="admin-trainer-reassign-dialog-title">Переназначить клиентов</h2>
            <p id="admin-trainer-reassign-dialog-description">
              Все {formatCount(assignedClientsCount, ["клиент", "клиента", "клиентов"])} будут переданы выбранному активному тренеру. История и планы клиентов сохранятся.
            </p>
            {safeReplacementTrainers.length ? (
              <label className={styles.trainerChoice}>
                <span>Новый тренер</span>
                <select value={selectedReplacementId} onChange={(event) => setSelectedReplacementId(event.target.value)} disabled={reassignPending}>
                  {safeReplacementTrainers.map((candidate, index) => {
                    const candidateId = String(candidate?.id || candidate?.uid || "").trim();
                    const candidateName = getText(candidate?.name, candidate?.fullName, candidate?.displayName, candidate?.email) || `Тренер ${index + 1}`;
                    return <option key={candidateId || `${candidateName}-${index}`} value={candidateId}>{candidateName}</option>;
                  })}
                </select>
              </label>
            ) : (
              <p className={styles.roleDialogError}>Нет другого активного тренера, которому можно передать клиентов.</p>
            )}
            {reassignError ? <p className={styles.roleDialogError} role="alert">{reassignError}</p> : null}
            <div className={styles.roleDialogActions}>
              <button className={styles.roleDialogCancel} type="button" onClick={closeReassignDialog} disabled={reassignPending}>Отмена</button>
              <button className={styles.roleDialogConfirm} type="button" onClick={confirmReassignClients} disabled={reassignPending || !selectedReplacementId}>
                {reassignPending ? "Переназначаем…" : "Передать клиентов"}
              </button>
              {typeof onDemoteWithReassignment === "function" ? (
                <button className={styles.roleDialogConfirm} type="button" onClick={confirmDemoteWithReassignment} disabled={reassignPending || !selectedReplacementId}>
                  {reassignPending ? "\u041e\u0431\u043d\u043e\u0432\u043b\u044f\u0435\u043c\u2026" : "\u041f\u0435\u0440\u0435\u0434\u0430\u0442\u044c \u0438 \u0441\u043d\u044f\u0442\u044c \u0440\u043e\u043b\u044c"}
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function MetricCard({ icon, value, label, accent }) {
  return (
    <article className={`${styles.metricCard} ${styles[`metric${accent[0].toLocaleUpperCase("ru")}${accent.slice(1)}`]}`}>
      <span className={styles.metricIcon}>{icon}</span>
      <strong>{Number.isFinite(value) ? value : "—"}</strong>
      <span>{label}</span>
    </article>
  );
}
