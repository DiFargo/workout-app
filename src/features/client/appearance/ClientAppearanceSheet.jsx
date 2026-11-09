import { useEffect, useRef } from "react";
import { Check, X } from "lucide-react";
import { setClientAppearance, useClientAppearancePreference } from "./clientAppearance.js";
import styles from "./ClientAppearanceSheet.module.css";

const OPTIONS = [["light", "Светлая"], ["dark", "Тёмная"]];
export default function ClientAppearanceSheet({ onClose, onRefresh }) {
  const preference = useClientAppearancePreference();
  const sheetRef = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    sheetRef.current?.querySelector("button")?.focus();
    function onKeyDown(event) {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const buttons = [...sheetRef.current.querySelectorAll("button")];
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); if (previous?.isConnected) previous.focus(); };
  }, [onClose]);
  return <div className={styles.overlay} data-modal-backdrop="true" onClick={onClose}>
    <section ref={sheetRef} className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="clientAppearanceTitle" data-modal-surface="true" onClick={event => event.stopPropagation()}>
      <span className={styles.handle} aria-hidden="true" />
      <header><h2 id="clientAppearanceTitle">Оформление</h2><button type="button" aria-label="Закрыть оформление" onClick={onClose}><X aria-hidden="true" /></button></header>
      <p>Выбери удобный вид приложения.</p>
      <div className={styles.options}>{OPTIONS.map(([value, label]) => <button type="button" key={value} aria-pressed={preference === value} onClick={() => setClientAppearance(value)}><span>{label}</span>{preference === value ? <Check aria-hidden="true" /> : null}</button>)}</div>
      {onRefresh && <button type="button" className={styles.refresh} onClick={() => { onClose(); onRefresh(); }}>Обновить данные</button>}
      <button type="button" className={styles.done} onClick={onClose}>Готово</button>
    </section>
  </div>;
}
