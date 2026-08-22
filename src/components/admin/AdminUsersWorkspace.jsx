/* eslint-disable react-refresh/only-export-components */
import { useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronRight,
  GraduationCap,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UserPlus,
  UsersRound
} from "lucide-react";
import styles from "./AdminUsersWorkspace.module.css";

export const ADMIN_USER_ROLE_FILTERS = [
  { id: "all", label: "Все" },
  { id: "client", label: "Клиенты" },
  { id: "trainer", label: "Тренеры" },
  { id: "admin", label: "Администраторы" }
];

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

function getAccountStatus(user) {
  const source = asText(user?.accountStatus || user?.status).toLocaleLowerCase("ru");

  if (user?.disabled || user?.accessDisabled || ["disabled", "blocked", "suspended", "заблокирован", "приостановлен"].includes(source)) {
    return { id: "blocked", label: "Доступ ограничен" };
  }

  if (["invited", "pending", "created", "ожидает", "приглашён", "revoked", "отозван"].includes(source)) {
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
  roleChangePending = false
}) {
  const role = getAdminUserRole(user);
  const roleMeta = getRoleMeta(role);
  const name = getAdminUserName(user);
  const status = getAccountStatus(user);
  const open = role === "trainer"
    ? onOpenTrainer
    : role === "client"
      ? onOpenClient
      : onOpenAdministrator;
  const isActionable = typeof open === "function";
  const canPromoteToTrainer = role === "client" && typeof onPromoteToTrainer === "function";
  const canAssignTrainer = role === "client" && typeof onAssignTrainer === "function";
  const assignedTrainerId = asText(user?.assignedTrainerId) || asText(user?.trainerId) || asText(user?.coachId);

  const content = (
    <>
      <UserAvatar user={user} name={name} />
      <span className={styles.userCopy}>
        <span className={styles.userTitleLine}>
          <strong>{name}</strong>
          <span className={`${styles.roleBadge} ${styles[`roleBadge${role}`] || ""}`.trim()}>{roleMeta.label}</span>
        </span>
        <span className={styles.userEmail}>{asText(user?.email) || "Email не указан"}</span>
        <span className={styles.userDescription}>{roleMeta.description}</span>
      </span>
      <span className={styles.userMeta}>
        <span className={`${styles.statusBadge} ${styles[`status${status.id}`] || ""}`.trim()}>{status.label}</span>
        {isActionable ? <ChevronRight aria-hidden="true" size={20} strokeWidth={2} /> : null}
      </span>
    </>
  );

  return (
    <article className={`${styles.userRow} ${canPromoteToTrainer || canAssignTrainer ? styles.userRowWithRoleAction : ""}`.trim()}>
      {isActionable ? (
        <button
          aria-label={`Открыть ${roleMeta.label.toLocaleLowerCase("ru")} ${name}`}
          className={`${styles.userOpenButton} ${styles.userRowAction}`.trim()}
          type="button"
          onClick={() => open(user)}
        >
          {content}
        </button>
      ) : (
        <div className={styles.userOpenButton}>{content}</div>
      )}

      {canPromoteToTrainer ? (
        <button
          aria-label={`Назначить ${name} тренером`}
          className={styles.promoteButton}
          disabled={roleChangePending}
          type="button"
          onClick={() => onPromoteToTrainer(user)}
        >
          <GraduationCap aria-hidden="true" size={17} strokeWidth={2} />
          <span>{roleChangePending ? "Назначаем…" : "Назначить тренером"}</span>
        </button>
      ) : null}

      {canAssignTrainer ? (
        <button
          aria-label={`${assignedTrainerId ? "Изменить назначение тренера для" : "Назначить тренера"} ${name}`}
          className={styles.assignTrainerButton}
          type="button"
          onClick={() => onAssignTrainer(user)}
        >
          <GraduationCap aria-hidden="true" size={17} strokeWidth={2} />
          <span>{assignedTrainerId ? "Изменить тренера" : "Назначить тренера"}</span>
        </button>
      ) : null}
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
  const [roleChangeUserId, setRoleChangeUserId] = useState("");
  const resolvedRole = ADMIN_USER_ROLE_FILTERS.some((item) => item.id === activeRole)
    ? activeRole
    : localRole;
  const resolvedSearch = typeof search === "string" ? search : localSearch;
  const sourceUsers = useMemo(() => (Array.isArray(users) ? users : []), [users]);

  const roleCounts = useMemo(() => sourceUsers.reduce((result, user) => {
    const role = getAdminUserRole(user);
    result.all += 1;
    result[role] += 1;
    return result;
  }, { all: 0, client: 0, trainer: 0, admin: 0 }), [sourceUsers]);

  const visibleUsers = useMemo(() => {
    const query = resolvedSearch.trim().toLocaleLowerCase("ru");

    return sourceUsers.filter((user) => {
      if (resolvedRole !== "all" && getAdminUserRole(user) !== resolvedRole) return false;
      if (!query) return true;

      return [
        getAdminUserName(user),
        asText(user?.email),
        asText(user?.id),
        asText(user?.uid)
      ].some((value) => value.toLocaleLowerCase("ru").includes(query));
    });
  }, [resolvedRole, resolvedSearch, sourceUsers]);

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
    if (typeof onPromoteToTrainer !== "function") return;

    const userId = getUserId(user);
    setRoleChangeUserId(userId);

    try {
      await onPromoteToTrainer(user);
    } finally {
      setRoleChangeUserId("");
    }
  };

  const hasSourceUsers = sourceUsers.length > 0;

  return (
    <section className={`${styles.root} ${className}`.trim()} data-testid="admin-users-workspace">
      <header className={styles.intro}>
        <span className={styles.introIcon} aria-hidden="true"><UsersRound size={24} strokeWidth={1.9} /></span>
        <div>
          <p className={styles.eyebrow}>Доступ и роли</p>
          <h2>Пользователи и роли</h2>
          <p>Клиенты, тренеры и администраторы — отдельные типы аккаунтов с разными рабочими правами.</p>
        </div>
      </header>

      <section className={styles.roleNote} aria-label="Как устроены роли">
        <ShieldCheck aria-hidden="true" size={20} strokeWidth={1.9} />
        <p><strong>Тренер — отдельная сущность.</strong> Откройте его карточку, чтобы работать с назначенными клиентами, личными программами и библиотекой упражнений.</p>
      </section>

      <section className={styles.directory} aria-label="Список пользователей">
        <div className={styles.directoryControls}>
          <div className={styles.roleTabs} role="tablist" aria-label="Фильтр по роли">
            {ADMIN_USER_ROLE_FILTERS.map((filter) => {
              const isActive = filter.id === resolvedRole;

              return (
                <button
                  aria-selected={isActive}
                  className={`${styles.roleTab} ${isActive ? styles.roleTabActive : ""}`.trim()}
                  key={filter.id}
                  role="tab"
                  type="button"
                  onClick={() => setRole(filter.id)}
                >
                  <span>{filter.label}</span>
                  <strong>{roleCounts[filter.id]}</strong>
                </button>
              );
            })}
          </div>

          <label className={styles.searchField}>
            <Search aria-hidden="true" size={20} strokeWidth={2} />
            <span className={styles.visuallyHidden}>Найти пользователя</span>
            <input
              placeholder="Найти по имени или email"
              type="search"
              value={resolvedSearch}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>

        <div className={styles.listHeader}>
          <div>
            <h3>{resolvedRole === "all" ? "Все пользователи" : getRoleMeta(resolvedRole).label}</h3>
            <p>{isLoading ? "Обновляем список…" : `${visibleUsers.length} ${visibleUsers.length === 1 ? "аккаунт" : "аккаунтов"}`}</p>
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
              <strong>Не удалось загрузить пользователей</strong>
              <p>{error}</p>
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
            <p>Измените запрос или выберите другую роль.</p>
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
                roleChangePending={Boolean(roleChangeUserId) && roleChangeUserId === getUserId(user)}
              />
            ))}
          </div>
        ) : null}
      </section>
    </section>
  );
}
