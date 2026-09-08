import { Bell, CalendarDays, ChevronRight, ClipboardList, Dumbbell, Link2, MessageCircle, Settings2, Utensils } from "lucide-react";
import styles from "./ProfileCabinetActionGrid.module.css";

function ActionRow({ kind, icon: Icon, title, note, status, onClick }) {
  return <div className={styles.rowWrap}>
    <button type="button" className={styles.row} data-testid={`profile-cabinet-action-${kind}`} onClick={onClick}>
      <span className={styles.icon}><Icon aria-hidden="true" /></span>
      <span className={styles.text}><strong>{title}</strong><small>{note}</small></span>
      {status ? <span className={styles.status}>{status}</span> : null}<ChevronRight className={styles.chevron} aria-hidden="true" />
    </button>
  </div>;
}

export default function ProfileCabinetActionGrid({ showClientOnlyActions, avatarUrl, displayName, email, telegramUsername, onOpenNutrition, onOpenCalendar, onOpenAccount, onOpenConnections, onOpenQuestionnaire, workoutModeLabel, onOpenWorkoutMode, onOpenNotifications, onOpenFeedback, onLogout }) {
  const initials = String(displayName || "Клиент").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <div className={`${styles.root}${showClientOnlyActions ? "" : ` ${styles.trainer}`}`} data-testid="profile-cabinet-action-grid">
    <section className={styles.profileCard}><span className={styles.avatar}>{avatarUrl ? <img src={avatarUrl} alt="" /> : initials}</span><span className={styles.profileCopy}><strong>{displayName || "Клиент"}</strong><small>{telegramUsername ? `@${telegramUsername.replace(/^@/, "")} · ` : ""}{email}</small><em>{showClientOnlyActions ? workoutModeLabel?.includes("Базовые") ? "Базовый план" : "Индивидуальный план" : "Кабинет тренера"}</em></span><button type="button" className={styles.edit} onClick={onOpenAccount} aria-label="Редактировать профиль" title="Редактировать профиль"><Settings2 aria-hidden="true" /></button></section>
    {showClientOnlyActions && <section className={styles.section}><h2>Мой план</h2><div className={styles.group}>
      <ActionRow kind="questionnaire" icon={ClipboardList} title="Параметры тела" onClick={onOpenQuestionnaire} />
      <ActionRow kind="nutrition" icon={Utensils} title="Цели питания" onClick={onOpenNutrition} />
      <ActionRow kind="workout-journal" icon={CalendarDays} title="Расписание тренировок" onClick={onOpenCalendar} />
      <ActionRow kind="workout-mode" icon={Dumbbell} title="Режим тренировок" status={workoutModeLabel?.includes("Базовые") ? "Базовый" : "С тренером"} onClick={onOpenWorkoutMode} />
    </div><p className={styles.note}>Дни занятий выбираете вы. {workoutModeLabel?.includes("Базовые") ? "Программа сохраняет порядок тренировок." : "Тренер может скорректировать расписание."}</p></section>}
    <section className={styles.section}><h2>Приложение</h2><div className={styles.group}>
      <ActionRow kind="notifications" icon={Bell} title="Уведомления" note="Настройка напоминаний" onClick={onOpenNotifications} />
      <ActionRow kind="account" icon={Link2} title="Подключение аккаунтов" note="Почта и Telegram" onClick={onOpenConnections} />
      <ActionRow kind="feedback" icon={MessageCircle} title="Помощь и обратная связь" onClick={onOpenFeedback} />
    </div></section>
    {onLogout ? <button type="button" className={styles.logout} data-testid="profile-cabinet-logout" onClick={onLogout}>Выйти из аккаунта</button> : null}
  </div>;
}
