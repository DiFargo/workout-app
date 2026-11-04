import { useEffect, useRef } from "react";
import styles from "./TelegramDuplicateWindow.module.css";

export default function TelegramDuplicateWindow({ hasInvitation = false }) {
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const closeWindow = () => {
    try { window.Telegram?.WebApp?.close?.(); } catch { /* Telegram owns the window. */ }
  };
  return (
    <main className={styles.screen}>
      <section className={styles.card} aria-labelledby="telegram-duplicate-title">
        <img src="/brand/ownset.svg?v=gradient-1" width="56" height="56" alt="" />
        <h1 id="telegram-duplicate-title" ref={heading} tabIndex={-1}>Приложение уже открыто</h1>
        <p>{hasInvitation
          ? "Чтобы принять приглашение, закройте другое окно ZMENA и нажмите «Продолжить здесь». Приглашение сохранено в этом окне."
          : "Продолжите в открытом окне Telegram. Вторую копию приложения запускать не нужно."}</p>
        <div className={styles.actions}>
          <button type="button" onClick={hasInvitation ? () => window.location.reload() : closeWindow}>{hasInvitation ? "Продолжить здесь" : "Закрыть это окно"}</button>
          <button type="button" className={styles.secondary} onClick={hasInvitation ? closeWindow : () => window.location.reload()}>{hasInvitation ? "Закрыть это окно" : "Проверить снова"}</button>
        </div>
        <p className={styles.hint}>{hasInvitation
          ? "Открытая тренировка в первом окне не изменяется."
          : "Первое окно уже закрыто? Нажмите «Проверить снова». Если это окно не закрывается, используйте крестик Telegram."}</p>
      </section>
    </main>
  );
}
