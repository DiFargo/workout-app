import { useEffect, useRef, useState } from "react";
import { startPrivateProgressPhotoLoad } from "../../utils/privateProgressPhoto.js";
import styles from "./PrivateProgressPhoto.module.css";

// Native img props (width, height, className, style, loading, onError...) are
// preserved. source is persisted private identity; preview is explicitly local.
export default function PrivateProgressPhoto({ source, preview, allowRetry = true, alt = "Фото прогресса", className = "", ...imageProps }) {
  const [media, setMedia] = useState({ url: "", status: "idle" });
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const safePreview = typeof preview === "string" && /^(?:blob:|data:image\/(?:jpeg|png|webp|gif|avif);base64,)/i.test(preview) ? preview : "";
  useEffect(() => {
    const requestId = ++generation.current;
    if (safePreview) return undefined;
    const request = startPrivateProgressPhotoLoad({ source, onState: next => {
      if (generation.current !== requestId) return;
      setMedia(current => generation.current === requestId ? { ...next, source } : current);
    } });
    return () => { generation.current = requestId + 1; request.dispose(); };
  }, [source, safePreview, retry]);
  const privateUrl = media.source === source && !media.signal?.aborted && media.session?.isCurrent() ? media.url : "";
  const url = safePreview || privateUrl;
  const status = safePreview ? "preview" : media.source === source ? media.status : "loading";
  return <span className={styles.frame} style={typeof imageProps.width === "number" ? { width: imageProps.width } : undefined}><img {...imageProps} className={`${styles.image} ${className}`.trim()}
    src={url || undefined} srcSet={undefined} referrerPolicy="no-referrer"
    onError={event => { imageProps.onError?.(event); if (!safePreview && url) setMedia(current => current.url === url && current.source === source ? { ...current, url: "", status: "error", accessDenied: false } : current); }}
    alt={!url && media.status === "error" ? `Фото недоступно: ${alt}` : alt}
    data-private-photo-state={status}
  />{!url && (status === "loading" || status === "error") && <span className={styles.feedback} role="status">
    <span>{status === "loading" ? "Загрузка фото…" : media.accessDenied ? "Нет доступа к фото" : "Не удалось загрузить фото"}</span>
    {allowRetry && status === "error" && !media.accessDenied && <button type="button" onClick={event => { event.preventDefault(); event.stopPropagation(); setRetry(value => value + 1); }} aria-label={`Повторить загрузку: ${alt || "фото прогресса"}`}>Повторить</button>}
  </span>}</span>;
}
