import { useEffect, useRef, useState } from "react";
import { Paperclip, RefreshCw } from "lucide-react";
import { auth } from "../../firebase";
import { captureAuthSession } from "../../utils/authSession.js";
import { fetchAuthorizedWithTimeout } from "../../utils/apiClient";
import styles from "./AdminFeedbackInbox.module.css";
import { useModalBackNavigation } from "../../shared/hooks/useModalBackNavigation.js";

const labels = { bug: "Ошибка", review: "Отзыв", idea: "Идея", recommendation: "Предложение" };
async function requestFeedback(body) {
  const response = await fetchAuthorizedWithTimeout("/api/admin/feedback", { method: "POST",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, 20000);
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok !== true) throw new Error(response.status === 403
    ? "Нет доступа. Подтвердите вход администратора ключом безопасности."
    : result.error || "Не удалось загрузить обращения. Повторите попытку.");
  return result;
}

function verifiedFileUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !/^(storage\.googleapis\.com|tren-85720(?:-staging)?\.firebasestorage\.app\.storage\.googleapis\.com)$/.test(url.hostname)) throw new Error("Не удалось проверить ссылку на файл.");
  return url.href;
}

function FeedbackPhoto({ item, file }) {
  const host = useRef(null), dialog = useRef(null);
  const [url, setUrl] = useState(""), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  useModalBackNavigation({ open: expanded, onBack: () => dialog.current?.close() });
  useEffect(() => {
    let active = true, started = false;
    const session = captureAuthSession(auth);
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting) || started) return;
      started = true; observer.disconnect();
      void requestFeedback({ action: "attachment", path: item.path, attachmentPath: file.path }).then(result => {
        const href = verifiedFileUrl(result.url);
        if (active && session.isCurrent()) { setUrl(href); setFailed(false); }
      }).catch(() => { if (active && session.isCurrent()) setFailed(true); });
    }, { rootMargin: "150px" });
    observer.observe(host.current);
    return () => { active = false; observer.disconnect(); };
  }, [item.path, file.path, attempt]);
  return <div className={styles.photo} ref={host}>
    {url && !failed ? <button type="button" className={styles.photoButton} aria-label={`Увеличить фото ${file.name}`} onClick={() => { dialog.current?.showModal(); setExpanded(true); }}>
      <img src={url} alt={file.name || "Фото из обращения"} onError={() => setFailed(true)} /><span>Увеличить фото</span>
    </button> : <div className={styles.photoPlaceholder}>{failed ? <button type="button" onClick={() => { setUrl(""); setFailed(false); setAttempt(value => value + 1); }}>Повторить загрузку фото</button> : <span role="status">Загружаем фото…</span>}</div>}
    <dialog ref={dialog} className={styles.photoViewer} aria-label="Просмотр фото обращения" onClose={() => setExpanded(false)}>
      <button type="button" className={styles.closePhoto} onClick={() => dialog.current?.close()}>Закрыть фото</button>
      {expanded && url ? <img src={url} alt={file.name || "Фото из обращения"} /> : null}
    </dialog>
  </div>;
}

export default function AdminFeedbackInbox() {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("new");
  const [type, setType] = useState("all");
  const mounted = useRef(false);
  const requestNumber = useRef(0);
  const actionBusy = useRef(false);

  async function load(next = "") {
    const session = captureAuthSession(auth), number = ++requestNumber.current;
    try {
      const result = await requestFeedback({ action: "list", cursor: next });
      if (!mounted.current || !session.isCurrent() || number !== requestNumber.current) return;
      setItems(current => next ? [...new Map([...current, ...result.items].map(item => [item.path, item])).values()] : result.items);
      setCursor(result.nextCursor || "");
    } catch (failure) {
      if (mounted.current && session.isCurrent() && number === requestNumber.current) setError(failure.message);
    } finally {
      if (mounted.current && session.isCurrent() && number === requestNumber.current) setBusy(false);
    }
  }
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; }; }, []);

  async function action(item, attachment) {
    if (actionBusy.current) return;
    const session = captureAuthSession(auth);
    const tab = attachment ? window.open("about:blank", "_blank") : null;
    if (tab) tab.opener = null;
    actionBusy.current = true; setBusy(true); setError("");
    try {
      const result = await requestFeedback(attachment ? { action: "attachment", path: item.path, attachmentPath: attachment.path }
        : { action: "status", path: item.path, status: item.status === "new" ? "processed" : "new" });
      if (!mounted.current || !session.isCurrent()) { tab?.close(); return; }
      if (attachment) {
        const url = new URL(result.url);
        if (url.protocol !== "https:" || !/^(storage\.googleapis\.com|tren-85720(?:-staging)?\.firebasestorage\.app\.storage\.googleapis\.com)$/.test(url.hostname)) throw new Error("Не удалось проверить ссылку на файл.");
        if (!tab) throw new Error("Разрешите открытие новой вкладки для скачивания файла.");
        tab.location.replace(url.href);
      } else setItems(current => current.map(row => row.path === item.path ? { ...row, status: item.status === "new" ? "processed" : "new" } : row));
    } catch (failure) { tab?.close(); if (mounted.current && session.isCurrent()) setError(failure.message); }
    finally { actionBusy.current = false; if (mounted.current && session.isCurrent()) setBusy(false); }
  }
  const visible = items.filter(item => (filter === "all" || item.status === filter) && (type === "all" || item.type === type));
  return <section className={styles.root} data-testid="admin-feedback-inbox" aria-label="Обращения пользователей">
    <div className={styles.toolbar}>
      <div role="group" aria-label="Статус обращений" className={styles.filters}>{[["new", "Новые"], ["processed", "Обработанные"], ["all", "Все"]].map(([id, label]) =>
        <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div>
      <label>Тип<select value={type} onChange={event => setType(event.target.value)}><option value="all">Все типы</option>{Object.entries(labels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <button type="button" disabled={busy} onClick={() => { setBusy(true); setError(""); void load(); }}><RefreshCw size={17} aria-hidden="true" />Обновить</button>
    </div>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {busy ? <p role="status">Загружаем…</p> : null}
    {!busy && !error && !visible.length ? <p className={styles.empty}>{cursor ? "В загруженных обращениях совпадений нет. Загрузите следующую страницу." : "Обращений с такими фильтрами пока нет."}</p> : null}
    <div className={styles.list}>{visible.map(item => <article key={item.path} className={styles.card}>
      <header className={styles.heading}>
        <span><small>{labels[item.type] || "Обращение"} · {item.status === "new" ? "Новое" : "Обработано"}</small><strong>{item.displayName || item.email || "Пользователь"}</strong></span>
        <time>{Number.isFinite(Date.parse(item.createdAt)) ? new Date(item.createdAt).toLocaleDateString("ru-RU") : "Без даты"}</time>
      </header>
      <div className={styles.detail}>
        <div className={styles.content}>
        <div className={styles.copy}>
        <p className={styles.message}>{item.message}</p>
        <p className={styles.meta}>Контакт: {item.contact || item.email || "Не указан"}{item.appVersion ? ` · Версия ${item.appVersion}` : ""}</p>
        </div>
        {item.attachments.some(file => /^image\/(jpeg|png|webp)$/.test(file.type)) ? <div className={styles.gallery}>{item.attachments.filter(file => /^image\/(jpeg|png|webp)$/.test(file.type)).map(file => <FeedbackPhoto key={file.path} item={item} file={file} />)}</div> : null}
        </div>
        <details className={styles.downloads}><summary>Файлы · {item.attachments.length}</summary>
        {item.attachments.map(file => <button key={file.path} className={styles.file} type="button" disabled={busy} onClick={() => void action(item, file)}><Paperclip size={17} aria-hidden="true" /><span>{file.name || "Вложение"}</span><small>Скачать</small></button>)}
        </details>
        <div className={styles.cardActions}>
        <button className={styles.primary} type="button" disabled={busy} onClick={() => void action(item)}>{item.status === "new" ? "Отметить обработанным" : "Вернуть в новые"}</button>
        </div>
      </div>
    </article>)}</div>
    {cursor ? <button type="button" disabled={busy} onClick={() => { setBusy(true); setError(""); void load(cursor); }}>Загрузить ещё</button> : null}
    <p className={styles.meta}>Загружено: {items.length}. Новые обращения сверху. Статус обработки не отправляет ответ пользователю автоматически.</p>
  </section>;
}
