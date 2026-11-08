import { Bell, CalendarDays, ChevronRight, ClipboardList, Dumbbell, Link2, MessageCircle, Settings2, Utensils, Info } from "lucide-react";
import { useState } from "react";
import ClientAppearanceSheet from "../appearance/ClientAppearanceSheet.jsx";
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
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [profileActionsOpen, setProfileActionsOpen] = useState(false);
  const initials = String(displayName || "Клиент").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <div className={`${styles.root}${showClientOnlyActions ? "" : ` ${styles.trainer}`}`} data-testid="profile-cabinet-action-grid">
    <section className={styles.profileCard}><span className={styles.avatar}>{avatarUrl ? <img src={avatarUrl} alt="" /> : initials}</span><span className={styles.profileCopy}><strong>{displayName || "Клиент"}</strong><small>{telegramUsername ? `@${telegramUsername.replace(/^@/, "")} · ` : ""}{email}</small><em>{showClientOnlyActions ? workoutModeLabel?.includes("Базовые") ? "Базовый план" : "Индивидуальный план" : "Кабинет тренера"}</em></span><button type="button" className={styles.edit} onClick={showClientOnlyActions ? () => setProfileActionsOpen(true) : onOpenAccount} aria-label="Редактировать профиль" title="Редактировать профиль"><Settings2 aria-hidden="true" /></button></section>
    {showClientOnlyActions && <section className={styles.section}><h2>Мой план</h2><div className={styles.group}>
      <ActionRow kind="workout-mode" icon={Dumbbell} title={workoutModeLabel?.includes("Базовые") ? "Базовые тренировки" : "Индивидуальная программа"} note={workoutModeLabel?.includes("Базовые") ? "Твой самостоятельный план" : "Тренировки под контролем тренера"} onClick={onOpenWorkoutMode} />
      <ActionRow kind="workout-journal" icon={CalendarDays} title="Расписание тренировок" onClick={onOpenCalendar} />
    </div><p className={styles.note}>Дни занятий выбираете вы. {workoutModeLabel?.includes("Базовые") ? "Программа сохраняет порядок тренировок." : "Тренер может скорректировать расписание."}</p></section>}
    <section className={styles.section}><h2>{showClientOnlyActions ? "Настройки" : "Приложение"}</h2><div className={styles.group}>
      <ActionRow kind="notifications" icon={Bell} title="Уведомления" note="Настройка напоминаний" onClick={onOpenNotifications} />
      <ActionRow kind="account" icon={Link2} title={showClientOnlyActions ? "Вход и безопасность" : "Подключение аккаунтов"} note={showClientOnlyActions ? "Email, пароль и Telegram" : "Почта и Telegram"} onClick={onOpenConnections} />
      {showClientOnlyActions && <ActionRow kind="appearance" icon={Settings2} title="Оформление" note="Светлая, тёмная или системная тема" onClick={() => setAppearanceOpen(true)} />}
      {!showClientOnlyActions && <ActionRow kind="feedback" icon={MessageCircle} title="Помощь и обратная связь" onClick={onOpenFeedback} />}
    </div></section>
    {showClientOnlyActions && <section className={styles.section}><h2>Мы рядом</h2><div className={styles.group}>
      <ActionRow kind="feedback" icon={MessageCircle} title="Обратная связь" note="Сообщить об ошибке или предложить идею" onClick={onOpenFeedback} />
      {showClientOnlyActions && <ActionRow kind="privacy" icon={Info} title="Данные и конфиденциальность" onClick={() => window.open("/privacy.html", "_blank", "noopener,noreferrer")} />}
    </div></section>}
    {onLogout ? <button type="button" className={styles.logout} data-testid="profile-cabinet-logout" onClick={onLogout}>Выйти из аккаунта</button> : null}
    {appearanceOpen && <ClientAppearanceSheet onClose={() => setAppearanceOpen(false)} />}
    {profileActionsOpen && <div className={styles.profileOverlay} data-modal-backdrop="true" onClick={() => setProfileActionsOpen(false)}><section className={styles.profileSheet} role="dialog" aria-modal="true" aria-label="Личные данные и цели" data-modal-surface="true" onClick={event => event.stopPropagation()}>
      <h2>Личные данные и цели</h2>
      <ActionRow kind="personal" icon={Settings2} title="Профиль и доступ" onClick={() => { setProfileActionsOpen(false); onOpenAccount?.(); }} />
      <ActionRow kind="questionnaire" icon={ClipboardList} title="Параметры тела" onClick={() => { setProfileActionsOpen(false); onOpenQuestionnaire?.(); }} />
      <ActionRow kind="nutrition" icon={Utensils} title="Цели питания" onClick={() => { setProfileActionsOpen(false); onOpenNutrition?.(); }} />
      <button type="button" className={styles.profileDone} onClick={() => setProfileActionsOpen(false)}>Готово</button>
    </section></div>}
  </div>;
}
