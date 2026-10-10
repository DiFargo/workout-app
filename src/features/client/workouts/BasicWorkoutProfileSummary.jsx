import { getMissingWorkoutProfileFields } from "../../../../functions/basicWorkoutPersonalization.js";
import styles from "./BasicWorkoutProfileSummary.module.css";

export default function BasicWorkoutProfileSummary({ context, loading, onEdit, specialStatus = "", onSpecialStatusChange }) {
  const profile = context.registration;
  const missing = getMissingWorkoutProfileFields(profile);
  const values = [profile.sex === "female" ? "Женщина" : profile.sex === "male" ? "Мужчина" : "Пол не указан",
    profile.age ? `${profile.age} лет` : "Возраст не указан", profile.height ? `${profile.height} см` : "Рост не указан",
    profile.weight ? `${profile.weight} кг` : "Вес не указан"];
  return <section className={styles.card} aria-label="Данные для персонализации">
    <div className={styles.heading}><strong>Учитываем твой профиль</strong>
      {onEdit ? <button type="button" onClick={onEdit}>Изменить</button> : null}</div>
    <p>{values.join(" · ")}</p>
    <small>{profile.weightMeasuredAt ? `Вес из замера ${profile.weightMeasuredAt}. ` : "Вес из профиля. "}
      {loading ? "Обновляем историю…" : `Тренировок в доступной истории за 90 дней: ${context.trainingHistory.length}.`}</small>
    <details><summary>Какие данные использует подбор</summary>
      <p>Пол, возраст, рост, вес, цель по весу, активность, ответы анкеты и сводка выполненных упражнений. Если сведений нет, мы их не угадываем. Вес снарядов вводится вручную.</p>
      <p>Эти данные и пожелания передаются Gemini. Имя, контакты, фотографии и переписка не отправляются. Обхваты тела и питание не используются для назначения силовой нагрузки.</p>
    </details>
    {missing.length ? <p className={styles.warning}>Для подбора заполни в кабинете: {missing.join(", ")}.</p> : null}
    <label><span>Особые состояния (если актуально)</span>
      <select value={specialStatus} onChange={(event) => onSpecialStatusChange(event.target.value)}>
        <option value="">Не указано</option><option value="none">Нет</option>
        <option value="pregnant">Беременность</option><option value="postpartum">Восстановление после родов</option>
        <option value="medical">Ограничения врача / восстановление</option>
      </select>
    </label>
  </section>;
}
