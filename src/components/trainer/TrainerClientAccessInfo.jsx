import { AtSign, Mail, MessageCircle } from "lucide-react";
import { getTrainerClientAccessInfo } from "../../utils/trainerClientAccessInfo.js";
import styles from "./TrainerClientAccessInfo.module.css";

const TELEGRAM_STATUS = {
  connected: "Подключён в профиле",
  disconnected: "Не подключён",
  unconfirmed: "Привязка не подтверждена",
  unknown: "Нет данных о привязке"
};

export default function TrainerClientAccessInfo({ client }) {
  const info = getTrainerClientAccessInfo(client);
  return <section className={styles.root} aria-label="Данные для входа и связи">
    <p className={styles.intro}>Сохранённые данные профиля клиента. Только просмотр.</p>
    <dl className={styles.card}>
      <div className={styles.row}>
        <dt><AtSign size={18} aria-hidden="true" />Логин</dt>
        <dd className={info.login ? styles.value : styles.empty}>{info.login || "Не указан"}</dd>
      </div>
      <div className={styles.row}>
        <dt><Mail size={18} aria-hidden="true" />Почта</dt>
        <dd className={info.email ? styles.value : styles.empty}>
          {info.email || (info.internalEmail ? "Личная почта не добавлена" : "Не указана")}
          {info.internalEmail ? <small>Служебный адрес скрыт</small> : null}
        </dd>
      </div>
      <div className={styles.row}>
        <dt><MessageCircle size={18} aria-hidden="true" />Telegram</dt>
        <dd>
          <span className={info.telegramUsername ? styles.value : styles.empty}>
            {info.telegramUsername ? `@${info.telegramUsername}` : info.telegramState === "connected" ? "Без публичного ника" : "Ник не указан"}
          </span>
          <small className={info.telegramState === "connected" ? styles.connected : styles.telegramStatus}>{TELEGRAM_STATUS[info.telegramState]}</small>
          {info.telegramState === "unconfirmed" && info.telegramUsername ? <small>Сохранённый ник не подтверждает вход через Telegram</small> : null}
        </dd>
      </div>
    </dl>
    <section className={styles.help} aria-label="Восстановление доступа">
      <h3>Если клиент забыл пароль</h3>
      <p>На экране входа выберите «Email или логин» → «Забыли пароль?». Ссылка для смены пароля придёт на почту аккаунта.</p>
      <p>Если доступа к почте нет или личная почта не добавлена, обратитесь к администратору.</p>
      <small>Пароли не отображаются и не меняются в карточке клиента.</small>
    </section>
  </section>;
}
