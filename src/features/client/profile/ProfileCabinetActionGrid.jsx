import { Bell, CalendarDays, Check, ChevronRight, ClipboardList, Dumbbell, Link2, MessageCircle, Settings2, ShieldCheck, Utensils, Info } from "lucide-react";
import { useState } from "react";
import ClientAppearanceSheet from "../appearance/ClientAppearanceSheet.jsx";
import { useClientAppearancePreference } from "../appearance/clientAppearance.js";
import styles from "./ProfileCabinetActionGrid.module.css";
import ClientReferenceIcon from "../../../shared/ui/ClientReferenceIcon.jsx";

function ActionRow({ kind, icon: Icon, title, note, status, onClick, referenceIcon }) {
  return <div className={styles.rowWrap}>
    <button type="button" className={styles.row} data-testid={`profile-cabinet-action-${kind}`} onClick={onClick}>
      <span className={styles.icon}>{referenceIcon ? <ClientReferenceIcon name={referenceIcon} /> : <Icon aria-hidden="true" />}</span>
      <span className={styles.text}><strong>{title}</strong>{note ? <small>{note}</small> : null}</span>
      {status ? <span className={styles.status}>{status}</span> : null}<ChevronRight className={styles.chevron} aria-hidden="true" />
    </button>
  </div>;
}

export default function ProfileCabinetActionGrid({ showClientOnlyActions, avatarUrl, displayName, email, telegramUsername, onOpenNutrition, onOpenCalendar, onOpenAccount, onOpenConnections, onOpenQuestionnaire, workoutModeLabel, onOpenWorkoutMode, onOpenNotifications, onOpenFeedback, onLogout }) {
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [profileActionsOpen, setProfileActionsOpen] = useState(false);
  const appearance = useClientAppearancePreference();
  const initials = String(displayName || "Клиент").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <div className={`${styles.root}${showClientOnlyActions ? "" : ` ${styles.trainer}`}`} data-testid="profile-cabinet-action-grid">
    <section className={styles.profileCard}><div className={styles.accountRow}><span className={styles.avatar}>{avatarUrl ? <img src={avatarUrl} alt="" /> : initials}</span><span className={styles.profileCopy}><strong>{displayName || "Клиент"}</strong><small>{showClientOnlyActions ? "Личные данные и доступ" : email}</small>{!showClientOnlyActions && <em>Кабинет тренера</em>}</span><button type="button" className={styles.edit} onClick={showClientOnlyActions ? () => setProfileActionsOpen(true) : onOpenAccount} aria-label="Редактировать профиль" title="Редактировать профиль">{showClientOnlyActions ? <ChevronRight aria-hidden="true" /> : <Settings2 aria-hidden="true" />}</button></div>{showClientOnlyActions && <button type="button" className={styles.connectionBadge} onClick={onOpenConnections}>{telegramUsername ? <Check aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}{telegramUsername ? "Telegram подключён" : "Настроить вход"}</button>}</section>
    {showClientOnlyActions && <section className={styles.section}><h2>Твой план</h2><div className={styles.group}>
      <ActionRow kind="workout-mode" icon={Dumbbell} referenceIcon="dumbbell" title={workoutModeLabel?.includes("Базовые") ? "Базовые тренировки" : "Индивидуальная программа"} note={workoutModeLabel?.includes("Базовые") ? "Твой самостоятельный план" : "Тренировки под контролем тренера"} onClick={onOpenWorkoutMode} />
      <ActionRow kind="workout-journal" icon={CalendarDays} referenceIcon="calendar" title="Расписание и абонемент" note="Даты занятий и оставшиеся тренировки" onClick={onOpenCalendar} />
    </div></section>}
    <section className={styles.section}><h2>{showClientOnlyActions ? "Настройки" : "Приложение"}</h2><div className={styles.group}>
      <ActionRow kind="notifications" icon={Bell} referenceIcon={showClientOnlyActions ? "bell" : undefined} title="Уведомления" note="Настройка напоминаний" onClick={onOpenNotifications} />
      <ActionRow kind="account" icon={showClientOnlyActions ? ShieldCheck : Link2} referenceIcon={showClientOnlyActions ? "shield" : undefined} title={showClientOnlyActions ? "Вход и безопасность" : "Подключение аккаунтов"} note={showClientOnlyActions ? "Email, пароль и Telegram" : "Почта и Telegram"} onClick={onOpenConnections} />
      {showClientOnlyActions && <ActionRow kind="appearance" icon={Settings2} referenceIcon="settings" title="Оформление" note={`Тема: ${appearance === "dark" ? "тёмная" : "светлая"}`} onClick={() => setAppearanceOpen(true)} />}
      {!showClientOnlyActions && <ActionRow kind="feedback" icon={MessageCircle} title="Помощь и обратная связь" onClick={onOpenFeedback} />}
    </div></section>
    {showClientOnlyActions && <section className={styles.section}><h2>Мы рядом</h2><div className={styles.group}>
      <ActionRow kind="feedback" icon={MessageCircle} referenceIcon="message" title="Обратная связь" note="Сообщить об ошибке или предложить идею" onClick={onOpenFeedback} />
      {showClientOnlyActions && <ActionRow kind="privacy" icon={Info} referenceIcon="info" title="Данные и конфиденциальность" onClick={() => window.open("/privacy.html", "_blank", "noopener,noreferrer")} />}
    </div></section>}
    {onLogout ? <button type="button" className={styles.logout} data-testid="profile-cabinet-logout" onClick={onLogout}>Выйти из аккаунта</button> : null}
    {appearanceOpen && <ClientAppearanceSheet onClose={() => setAppearanceOpen(false)} />}
    {profileActionsOpen && <div className={styles.profileOverlay} data-modal-backdrop="true" onClick={() => setProfileActionsOpen(false)}><section className={styles.profileSheet} role="dialog" aria-modal="true" aria-label="Личные данные и цели" data-modal-surface="true" onClick={event => event.stopPropagation()}>
      <h2>Личные данные и цели</h2>
      <p className={styles.accountDetails}>{telegramUsername ? `@${telegramUsername.replace(/^@/, "")} · ` : ""}{email}</p>
      <ActionRow kind="personal" icon={Settings2} title="Профиль и доступ" onClick={() => { setProfileActionsOpen(false); onOpenAccount?.(); }} />
      <ActionRow kind="questionnaire" icon={ClipboardList} title="Параметры тела" onClick={() => { setProfileActionsOpen(false); onOpenQuestionnaire?.(); }} />
      <ActionRow kind="nutrition" icon={Utensils} title="Цели питания" onClick={() => { setProfileActionsOpen(false); onOpenNutrition?.(); }} />
      <button type="button" className={styles.profileDone} onClick={() => setProfileActionsOpen(false)}>Готово</button>
    </section></div>}
  </div>;
}
