import { Scale } from "lucide-react";
import styles from "./ProfileWeightCheckInReminder.module.css";

export default function ProfileWeightCheckInReminder({ checkIn, onOpen }) {
  if (!checkIn?.isDue) return null;

  const title = checkIn.isFirst
    ? "Добавьте первый вес"
    : checkIn.isOverdue
      ? "Пора обновить вес"
      : "Пора взвеситься";
  const description = checkIn.isFirst
    ? "Контроль веса раз в неделю помогает видеть настоящую динамику."
    : checkIn.isOverdue
      ? `Последнее взвешивание: ${checkIn.latestDateText}.`
      : "Регулярный контроль веса помогает видеть настоящую динамику.";

  return (
    <section className={styles.root} data-testid="profile-weight-checkin-reminder" aria-label="Контроль веса">
      <span className={styles.icon} aria-hidden="true"><Scale size={21} strokeWidth={2.2} /></span>
      <span className={styles.copy}>
        <small>КОНТРОЛЬ ВЕСА</small>
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
      <button type="button" className={styles.action} data-testid="profile-weight-checkin-action" onClick={onOpen}>
        Взвеситься
      </button>
    </section>
  );
}
