/* eslint-disable react-refresh/only-export-components */
import { useId, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronRight,
  GraduationCap,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UserPlus,
  X
} from "lucide-react";
import styles from "./AdminUsersWorkspace.module.css";
import { getAdminAttentionFilter, matchesAdminAttentionFilter } from "./adminAttentionQueue.js";

export const ADMIN_USER_ROLE_FILTERS = [
  { id: "all", label: "Все" },
  { id: "client", label: "Клиенты" },
  { id: "trainer", label: "Тренеры" },
  { id: "admin", label: "Администраторы", shortLabel: "Админы" }
];

const ACCOUNT_FILTERS = [
  { id: "all", label: "Все состояния" },
  { id: "active", label: "Активные" },
  { id: "pending", label: "Ожидают" },
  { id: "blocked", label: "Доступ ограничен" },
  { id: "inactive", label: "Неактивные и архив" }
];

function searchText(value) {
  return String(value ?? "").normalize("NFKC").toLocaleLowerCase("ru-RU").replaceAll("ё", "е").replaceAll("@", "").trim();
}

function asText(value) {
  return String(value || "").trim();
}

export function getAdminUserRole(user) {
  const value = asText(user?.role).toLocaleLowerCase("ru");

  if (["admin", "administrator", "админ", "администратор"].includes(value)) return "admin";
  if (["trainer", "coach", "тренер", "коуч"].includes(value)) return "trainer";
  return "client";
}

export function getAdminUserName(user) {
  return asText(user?.displayName)
    || asText(user?.name)
    || asText(user?.fullName)
    || asText(user?.email).split("@")[0]
    || "Без имени";
}

function getUserId(user) {
  return asText(user?.id) || asText(user?.uid) || asText(user?.email);
}

function getRoleMeta(role) {
  if (role === "trainer") {
    return {
      label: "Тренер",
      description: "Ведёт клиентов и собственные рабочие материалы"
    };
  }

  if (role === "admin") {
    return {
      label: "Администратор",
      description: "Управляет доступом и общими материалами"
    };
  }

  return {
    label: "Клиент",
    description: "Пользуется приложением и своим планом"
  };
}

export function getAdminAccountStatus(user) {
  const source = asText(user?.accountStatus || user?.status).toLocaleLowerCase("ru");
  const membership = asText(user?.membershipStatus).toLocaleLowerCase("ru");

  if (user?.archived === true || source === "archived") return { id: "inactive", label: "Архив" };
  if (membership === "revoked" || ["revoked", "отозван"].includes(source)) return { id: "blocked", label: "Доступ отозван" };
  if (membership === "suspended" || ["suspended", "приостановлен"].includes(source)) return { id: "blocked", label: "Доступ приостановлен" };

  if (user?.disabled || user?.accessDisabled || ["disabled", "blocked", "suspended", "заблокирован", "приостановлен"].includes(source)) {
    return { id: "blocked", label: "Доступ ограничен" };
  }

  if (user?.active === false || source === "inactive") return { id: "inactive", label: "Неактивен" };
  if (user?.accountAccessStatus === "awaiting_trainer") return { id: "pending", label: "Ожидает назначения тренера" };

  if (["invited", "pending", "created", "ожидает", "приглашён"].includes(source)) {
    return { id: "pending", label: "Ожидает активации" };
  }

  return { id: "active", label: "Активен" };
}

function UserAvatar({ user, name }) {
  const imageUrl = asText(user?.photoURL) || asText(user?.avatarUrl) || asText(user?.avatar);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1))
    .join("")
    .toLocaleUpperCase("ru") || "?";

  return (
    <span className={styles.avatar} aria-hidden="true">
      <span className={styles.avatarFallback}>{initials}</span>
      {imageUrl ? (
        <img
          alt=""
          className={styles.avatarImage}
          src={imageUrl}
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      ) : null}
    </span>
  );
}

function UserRow({
  user,
  onOpenAdministrator,
  onOpenClient,
  onOpenTrainer,
  onAssignTrainer,
  onPromoteToTrainer,
  roleChangePending = false,
  roleChangeBusy = false,
  notice,
  trainerNames,
  onRetry
}) {
  const rowId = useId();
  const role = getAdminUserRole(user);
  const roleMeta = getRoleMeta(role);
  const name = getAdminUserName(user);
  const status = getAdminAccountStatus(user);
  const open = role === "trainer"
    ? onOpenTrainer
    : role === "client"
      ? onOpenClient
      : onOpenAdministrator;
  const isActionable = typeof open === "function";
  const canPromoteToTrainer = role === "client" && typeof onPromoteToTrainer === "function";
  const canAssignTrainer = role === "client" && typeof onAssignTrainer === "function";
  const assignedTrainerId = asText(user?.assignedTrainerId) || asText(user?.trainerId) || asText(user?.coachId);
  const trainerLabel = assignedTrainerId
    ? trainerNames?.get(assignedTrainerId) || `ID …${assignedTrainerId.slice(-8)}`
    : asText(user?.assignedTrainerEmail || user?.trainerEmail || user?.coachEmail) || "Не назначен";
  const login = asText(user?.loginLower || user?.accountProfile?.login);
  const telegram = asText(user?.telegram?.username || user?.telegramUsername).replace(/^@/, "");
  const contact = [asText(user?.email), login && `Логин: ${login}`, telegram && `@${telegram}`].filter(Boolean).join(" · ");

  const content = (
    <>
      <UserAvatar user={user} name={name} />
      <span className={styles.userCopy}>
        <span className={styles.userTitleLine}>
          <strong>{name}</strong>
          <span className={`${styles.roleBadge} ${styles[`roleBadge${role}`] || ""}`.trim()}>{roleMeta.label}</span>
        </span>
        <span className={styles.userEmail} id={`${rowId}-contact`} title={contact}>{contact || "Контакты не указаны"}</span>
        <span className={styles.userFacts} id={`${rowId}-facts`}>
          <span className={`${styles.statusBadge} ${styles[`status${status.id}`] || ""}`.trim()}>{status.label}</span>
          {role === "client" ? <span className={styles.trainerName}>Тренер: {trainerLabel}</span> : null}
        </span>
      </span>
      <span className={styles.userMeta} title={getUserId(user)}>
        <small id={`${rowId}-identity`} aria-label={`ID: ${getUserId(user)}`}>ID …{getUserId(user).slice(-8)}</small>
        {isActionable ? <ChevronRight aria-hidden="true" size={20} strokeWidth={2} /> : null}
      </span>
    </>
  );

  return (
    <article className={`${styles.userRow} ${canPromoteToTrainer || canAssignTrainer ? styles.userRowWithRoleAction : ""}`.trim()}>
      {isActionable ? (
        <button
          aria-label={`Открыть ${roleMeta.label.toLocaleLowerCase("ru")} ${name}`}
          aria-describedby={`${rowId}-contact ${rowId}-facts ${rowId}-identity`}
          className={`${styles.userOpenButton} ${styles.userRowAction}`.trim()}
          type="button"
          disabled={roleChangeBusy}
          onClick={() => open(user)}
        >
          {content}
        </button>
      ) : (
        <div className={styles.userOpenButton}>{content}</div>
      )}

      {canPromoteToTrainer || canAssignTrainer ? <div className={styles.userActions}>
      {canAssignTrainer ? (
        <button
          aria-label={`${assignedTrainerId ? "Изменить назначение тренера для" : "Назначить тренера"} ${name}`}
          className={styles.assignTrainerButton}
          type="button"
          disabled={roleChangeBusy}
          onClick={() => onAssignTrainer(user)}
        >
          <GraduationCap aria-hidden="true" size={17} strokeWidth={2} />
          <span>{assignedTrainerId ? "Изменить тренера" : "Назначить тренера"}</span>
        </button>
      ) : null}
      {canPromoteToTrainer ? (
        <details className={styles.roleManagement}>
          <summary>Управление ролью</summary>
          <button
            aria-label={`Изменить роль ${name} на «Тренер»`}
            className={styles.promoteButton}
            disabled={roleChangePending}
            type="button"
            onClick={() => onPromoteToTrainer(user)}
          >
            <ShieldCheck aria-hidden="true" size={17} strokeWidth={2} />
            <span>{roleChangeBusy ? "Меняем роль…" : "Изменить роль на «Тренер»"}</span>
          </button>
        </details>
      ) : null}
      </div> : null}
      {notice ? <div className={`${styles.rowNotice} ${notice.error ? styles.rowNoticeError : ""}`} role={notice.error ? "alert" : "status"}>
        <p>{notice.text}</p>
        {notice.error && typeof onRetry === "function" ? <button type="button" onClick={onRetry}>Обновить список</button> : null}
      </div> : null}
    </article>
  );
}

function LoadingRows() {
  return (
    <div className={styles.loadingRows} aria-label="Загружаем пользователей">
      {[0, 1, 2].map((item) => <span className={styles.loadingRow} key={item} />)}
    </div>
  );
}

/**
 * Admin-only presentation workspace for accounts and roles. It intentionally does
 * not include trainer CRM widgets: a trainer opens through onOpenTrainer, while
 * clients and administrators can receive their own account callbacks.
 */
export default function AdminUsersWorkspace({
  activeRole,
  attentionFilter = "",
  onClearAttentionFilter,
  className = "",
  error = "",
  isLoading = false,
  onOpenAdministrator,
  onOpenClient,
  onOpenTrainer,
  onAssignTrainer,
  onInviteTrainer,
  onPromoteToTrainer,
  onRetry,
  onRoleChange,
  onSearchChange,
  search,
  users
}) {
  const [localRole, setLocalRole] = useState("all");
  const [localSearch, setLocalSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [roleChangeUserId, setRoleChangeUserId] = useState("");
  const [roleChangeNotice, setRoleChangeNotice] = useState(null);
  const roleChangePendingRef = useRef(false);
  const resolvedRole = ADMIN_USER_ROLE_FILTERS.some((item) => item.id === activeRole)
    ? activeRole
    : localRole;
  const resolvedSearch = typeof search === "string" ? search : localSearch;
  const attention = getAdminAttentionFilter(attentionFilter);
  const sourceUsers = useMemo(() => (Array.isArray(users) ? users : []), [users]);
  const trainerNames = useMemo(() => new Map(sourceUsers.filter(user => getAdminUserRole(user) === "trainer")
    .map(user => [getUserId(user), getAdminUserName(user)])), [sourceUsers]);

  const roleCounts = useMemo(() => sourceUsers.reduce((result, user) => {
    const role = getAdminUserRole(user);
    result.all += 1;
    result[role] += 1;
    return result;
  }, { all: 0, client: 0, trainer: 0, admin: 0 }), [sourceUsers]);

  const visibleUsers = useMemo(() => {
    const terms = searchText(resolvedSearch).split(/\s+/).filter(Boolean);

    return sourceUsers.filter((user) => {
      if (resolvedRole !== "all" && getAdminUserRole(user) !== resolvedRole) return false;
      if (!matchesAdminAttentionFilter(user, attentionFilter, getAdminUserRole(user), getAdminAccountStatus(user).id)) return false;
      if (accountFilter !== "all" && getAdminAccountStatus(user).id !== accountFilter) return false;
      if (!terms.length) return true;

      const searchable = [
        getAdminUserName(user),
        asText(user?.name),
        asText(user?.fullName),
        asText(user?.email),
        asText(user?.loginLower),
        asText(user?.accountProfile?.login),
        asText(user?.id),
        asText(user?.uid),
        asText(user?.telegram?.username),
        asText(user?.telegramUsername),
        asText(user?.telegram?.telegramUserId),
        asText(user?.telegramUserId)
      ].map(searchText).join(" ");
      return terms.every(term => searchable.includes(term));
    });
  }, [resolvedRole, resolvedSearch, sourceUsers, attentionFilter, accountFilter]);

  const setRole = (nextRole) => {
    if (typeof onRoleChange === "function") {
      onRoleChange(nextRole);
    } else {
      setLocalRole(nextRole);
    }
  };

  const setSearch = (nextSearch) => {
    if (typeof onSearchChange === "function") {
      onSearchChange(nextSearch);
    } else {
      setLocalSearch(nextSearch);
    }
  };

  const promoteToTrainer = async (user) => {
    if (typeof onPromoteToTrainer !== "function" || roleChangePendingRef.current) return;

    const userId = getUserId(user);
    roleChangePendingRef.current = true;
    setRoleChangeUserId(userId);
    setRoleChangeNotice(null);

    try {
      const result = await onPromoteToTrainer(user);
      if (result === true || result?.ok === true) setRoleChangeNotice({ id: userId, text: `Роль ${getAdminUserName(user)} изменена на «Тренер».`, error: false });
    } catch {
      setRoleChangeNotice({ id: userId, text: `Не удалось подтвердить смену роли для ${getAdminUserName(user)}. Обновите список и проверьте роль аккаунта перед повторной попыткой.`, error: true });
    } finally {
      roleChangePendingRef.current = false;
      setRoleChangeUserId("");
    }
  };

  const hasSourceUsers = sourceUsers.length > 0;
  const hasFilters = Boolean(resolvedSearch || resolvedRole !== "all" || accountFilter !== "all" || attention);
  const clearFilters = () => {
    setSearch("");
    setAccountFilter("all");
    if (attention) onClearAttentionFilter?.();
    setRole("all");
  };

  return (
    <section className={`${styles.root} ${className}`.trim()} data-testid="admin-users-workspace">
      {roleChangeNotice && !visibleUsers.some(user => getUserId(user) === roleChangeNotice.id) ? <section className={styles.errorState} role={roleChangeNotice.error ? "alert" : "status"}>
        <p>{roleChangeNotice.text}</p>
        {typeof onRetry === "function" ? <button type="button" onClick={onRetry}>Обновить список</button> : null}
      </section> : null}
      <section className={styles.directory} aria-label="Список пользователей" aria-busy={isLoading}>
        {attention ? <div className={styles.attentionFilter} role="status">
          <div><strong>{attention.title}</strong><p>Список обновляется по текущим данным. Поиск дополнительно сужает эту очередь.</p></div>
          <button type="button" onClick={onClearAttentionFilter}>Снять фильтр очереди</button>
        </div> : null}
        <div className={styles.directoryControls}>
          <div className={styles.roleTabs} role="group" aria-label="Фильтр по роли">
            {ADMIN_USER_ROLE_FILTERS.map((filter) => {
              const isActive = filter.id === resolvedRole;

              return (
                <button
                  aria-pressed={isActive}
                  aria-label={`${filter.label}: ${!hasSourceUsers && (isLoading || error) ? "не загружено" : roleCounts[filter.id]}`}
                  className={`${styles.roleTab} ${isActive ? styles.roleTabActive : ""}`.trim()}
                  key={filter.id}
                  type="button"
                  onClick={() => setRole(filter.id)}
                >
                  <span>{filter.shortLabel || filter.label}</span>
                  <strong>{!hasSourceUsers && (isLoading || error) ? "—" : roleCounts[filter.id]}</strong>
                </button>
              );
            })}
          </div>

          <div className={styles.searchField}>
            <Search aria-hidden="true" size={20} strokeWidth={2} />
            <input
              aria-label="Найти пользователя"
              autoComplete="off"
              placeholder="Имя, логин, email, Telegram или ID"
              type="search"
              value={resolvedSearch}
              onChange={(event) => setSearch(event.target.value)}
            />
            {resolvedSearch ? <button type="button" className={styles.clearSearch} aria-label="Очистить поиск" onClick={() => setSearch("")}><X aria-hidden="true" size={18} /></button> : null}
          </div>
        </div>
        <div className={styles.secondaryFilters}>
          <label>Состояние<select value={accountFilter} onChange={event => setAccountFilter(event.target.value)}>{ACCOUNT_FILTERS.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
          {hasFilters ? <button type="button" onClick={clearFilters}>Сбросить поиск и фильтры</button> : null}
        </div>

        <div className={styles.listHeader}>
          <div>
            <h2>{resolvedRole === "all" ? "Все пользователи" : ADMIN_USER_ROLE_FILTERS.find((item) => item.id === resolvedRole)?.label}</h2>
            <p role="status" aria-live="polite" aria-atomic="true">{!hasSourceUsers && (isLoading || error) ? isLoading ? "Загружаем пользователей…" : "Список не загружен" : `${isLoading ? "Обновляем данные · " : ""}Показано ${visibleUsers.length} из ${sourceUsers.length}`}</p>
          </div>
          {typeof onInviteTrainer === "function" ? (
            <button className={styles.inviteTrainerButton} type="button" onClick={onInviteTrainer}>
              <UserPlus aria-hidden="true" size={18} strokeWidth={2.1} />
              Пригласить тренера
            </button>
          ) : null}
        </div>

        {isLoading && !hasSourceUsers ? <LoadingRows /> : null}

        {!isLoading && error ? (
          <section className={styles.errorState} role="alert">
            <AlertCircle aria-hidden="true" size={22} strokeWidth={2} />
            <div>
              <strong>{hasSourceUsers ? "Не удалось обновить список" : "Не удалось загрузить пользователей"}</strong>
              <p>{error}</p>
              {hasSourceUsers ? <p>Показываем ранее загруженные аккаунты.</p> : null}
            </div>
            {typeof onRetry === "function" ? (
              <button type="button" onClick={onRetry}>
                <RefreshCw aria-hidden="true" size={17} strokeWidth={2} />
                Повторить
              </button>
            ) : null}
          </section>
        ) : null}

        {!isLoading && !error && !hasSourceUsers ? (
          <section className={styles.emptyState}>
            <UserRound aria-hidden="true" size={28} strokeWidth={1.8} />
            <h3>Пользователей пока нет</h3>
            <p>Когда в системе появятся аккаунты, они будут показаны здесь с актуальной ролью.</p>
          </section>
        ) : null}

        {!isLoading && !error && hasSourceUsers && visibleUsers.length === 0 ? (
          <section className={styles.emptyState}>
            <Search aria-hidden="true" size={28} strokeWidth={1.8} />
            <h3>Ничего не найдено</h3>
            <p>{attention ? "По текущим данным и запросу в этой очереди никого нет. Измените поиск или снимите фильтр очереди." : "Измените запрос, роль или состояние аккаунта."}</p>
            {hasFilters ? <button type="button" className={styles.resetEmpty} onClick={clearFilters}>Показать всех пользователей</button> : null}
          </section>
        ) : null}

        {visibleUsers.length ? (
          <div className={styles.userList}>
            {visibleUsers.map((user, index) => (
              <UserRow
                key={getUserId(user) || `${getAdminUserName(user)}-${index}`}
                user={user}
                onOpenAdministrator={onOpenAdministrator}
                onOpenClient={onOpenClient}
                onOpenTrainer={onOpenTrainer}
                onAssignTrainer={onAssignTrainer}
                onPromoteToTrainer={onPromoteToTrainer ? promoteToTrainer : undefined}
                roleChangePending={Boolean(roleChangeUserId)}
                roleChangeBusy={Boolean(roleChangeUserId) && roleChangeUserId === getUserId(user)}
                notice={roleChangeNotice?.id === getUserId(user) ? roleChangeNotice : null}
                trainerNames={trainerNames}
                onRetry={onRetry}
              />
            ))}
          </div>
        ) : null}
      </section>
    </section>
  );
}
