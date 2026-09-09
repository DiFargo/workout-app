import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export default function TrainerEditorSheet({ title, onClose, children, className, bodyClassName, footer, role }) {
  const ref = useRef(null);
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className={className} role={role} aria-label={title}
    onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}>
    <header><h2>{title}</h2><button type="button" aria-label={`Закрыть ${title.toLocaleLowerCase("ru")}`} onClick={onClose}><X size={20} /></button></header>
    <div className={bodyClassName}>{children}</div>
    <footer>{footer || <><span>Изменения применятся после сохранения программы</span><button type="button" onClick={onClose}>Готово</button></>}</footer>
  </dialog>;
}
