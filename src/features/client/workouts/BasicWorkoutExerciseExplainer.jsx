import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Ellipsis, GraduationCap, MessageSquare, RefreshCw } from "lucide-react";

import { useModalBackNavigation } from "../../../shared/hooks/useModalBackNavigation";

import styles from "./BasicWorkoutExerciseExplainer.module.css";

const EXPLAINER_ACTIONS = [
  { id: "technique", label: "Техника", Icon: GraduationCap },
  { id: "swap", label: "Заменить", Icon: RefreshCw },
  { id: "note", label: "Заметки", Icon: MessageSquare }
];

function CompactExerciseControls({ onOpenTechnique, onOpenSwap, onOpenNote, isNoteOpen, swapUnavailableReason }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();
  const triggerId = useId();
  const reasonId = useId();
  const unavailableReason = swapUnavailableReason || "Для этого упражнения пока нет вариантов замены";
  const closeMenu = useCallback((restoreFocus = true) => {
    setMenuOpen(false);
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  useModalBackNavigation({ open: menuOpen, onBack: closeMenu });

  useLayoutEffect(() => {
    if (!menuOpen) return undefined;
    const menu = menuRef.current;
    const trigger = triggerRef.current;
    if (!menu || !trigger) return undefined;

    const positionMenu = () => {
      const anchor = trigger.getBoundingClientRect();
      const viewport = window.visualViewport;
      const leftEdge = (viewport?.offsetLeft || 0) + 12;
      const topEdge = (viewport?.offsetTop || 0) + 12;
      const rightEdge = leftEdge + (viewport?.width || window.innerWidth) - 24;
      const bottomEdge = topEdge + (viewport?.height || window.innerHeight) - 24;
      const width = menu.offsetWidth;
      const height = menu.offsetHeight;
      const below = bottomEdge - anchor.bottom;
      const above = anchor.top - topEdge;
      const proposedTop = below >= height + 8 || below >= above
        ? anchor.bottom + 8
        : anchor.top - height - 8;
      menu.style.left = `${Math.max(leftEdge, Math.min(anchor.right - width, rightEdge - width))}px`;
      menu.style.top = `${Math.max(topEdge, Math.min(proposedTop, bottomEdge - height))}px`;
      menu.dataset.positioned = "true";
    };
    const closeOutside = (event) => {
      if (!menu.contains(event.target) && !trigger.contains(event.target)) closeMenu(false);
    };
    positionMenu();
    (menu.querySelector('button:not(:disabled)') || menu).focus({ preventScroll: true });
    document.addEventListener("pointerdown", closeOutside, true);
    document.addEventListener("focusin", closeOutside);
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    window.visualViewport?.addEventListener("resize", positionMenu);
    window.visualViewport?.addEventListener("scroll", positionMenu);
    return () => {
      document.removeEventListener("pointerdown", closeOutside, true);
      document.removeEventListener("focusin", closeOutside);
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
      window.visualViewport?.removeEventListener("resize", positionMenu);
      window.visualViewport?.removeEventListener("scroll", positionMenu);
    };
  }, [menuOpen, closeMenu]);

  return (
    <nav className={`${styles.tabs} ${styles.compactTabs}`} aria-label="Действия с упражнением">
      <button
        type="button"
        className={`${styles.tab} ${styles.compactTab}`}
        data-css-module-control="workout-exercise-tool"
        aria-label="Открыть раздел «Техника»"
        onClick={(event) => { event.stopPropagation(); onOpenTechnique?.(event); }}
        onTouchStart={(event) => event.stopPropagation()}
      >
        <GraduationCap aria-hidden="true" />
        <span>Техника</span>
      </button>
      <button
        type="button"
        className={`${styles.tab} ${styles.compactTab} ${isNoteOpen ? styles.activeTab : ""}`}
        data-css-module-control="workout-exercise-tool"
        aria-label="Открыть заметку тренеру"
        aria-pressed={isNoteOpen}
        onClick={(event) => { event.stopPropagation(); onOpenNote?.(event); }}
        onTouchStart={(event) => event.stopPropagation()}
      >
        <MessageSquare aria-hidden="true" />
        <span>Заметка</span>
      </button>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className={`${styles.tab} ${styles.compactTab} ${styles.moreButton}`}
        data-css-module-control="workout-exercise-tool"
        aria-label="Другие действия с упражнением"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? menuId : undefined}
        onClick={(event) => { event.stopPropagation(); setMenuOpen((current) => !current); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            event.stopPropagation();
            setMenuOpen(true);
          } else if (event.key === "Escape" && menuOpen) {
            event.preventDefault();
            event.stopPropagation();
            closeMenu();
          }
        }}
        onTouchStart={(event) => event.stopPropagation()}
      >
        <Ellipsis aria-hidden="true" />
      </button>
      {menuOpen && typeof document !== "undefined" ? createPortal(
        <div
          ref={menuRef}
          id={menuId}
          className={styles.actionsMenu}
          role="menu"
          tabIndex={-1}
          aria-labelledby={triggerId}
          aria-describedby={!onOpenSwap ? reasonId : undefined}
          onClick={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
          onTouchEnd={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              closeMenu();
            } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              event.stopPropagation();
              menuRef.current?.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
            } else if (event.key === "Tab") {
              // Resume the toolbar's natural tab order rather than the portal's body position.
              closeMenu();
            }
          }}
        >
          <button
            type="button"
            role="menuitem"
            className={styles.menuAction}
            data-css-module-control="workout-exercise-tool"
            aria-label="Заменить упражнение"
            aria-describedby={!onOpenSwap ? reasonId : undefined}
            disabled={!onOpenSwap}
            onClick={() => { closeMenu(); onOpenSwap?.(); }}
          >
            <RefreshCw aria-hidden="true" />
            <span>Заменить упражнение</span>
          </button>
          {!onOpenSwap ? <p id={reasonId} className={styles.unavailableReason} role="none">{unavailableReason}</p> : null}
        </div>,
        document.body
      ) : null}
    </nav>
  );
}

export default function BasicWorkoutExerciseExplainer({
  children,
  onOpenTechnique,
  onOpenSwap,
  onOpenNote,
  isNoteOpen = false,
  compactControls = false,
  swapUnavailableReason = ""
}) {
  return (
    <section className={styles.explainer} data-testid="basic-workout-exercise-explainer" aria-label="Материалы к упражнению">
      <div className={styles.content} data-workout-media-area>{children}</div>

      {compactControls ? (
        <CompactExerciseControls
          onOpenTechnique={onOpenTechnique}
          onOpenSwap={onOpenSwap}
          onOpenNote={onOpenNote}
          isNoteOpen={isNoteOpen}
          swapUnavailableReason={swapUnavailableReason}
        />
      ) : <nav className={styles.tabs} aria-label="Действия с упражнением">
        {EXPLAINER_ACTIONS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`${styles.tab} ${id === "note" && isNoteOpen ? styles.activeTab : ""}`}
            aria-label={id === "swap"
              ? "Заменить упражнение"
              : id === "note"
                ? "Открыть заметку тренеру"
                : `Открыть раздел «${label}»`}
            aria-pressed={id === "note" ? isNoteOpen : undefined}
            disabled={id === "swap" && !onOpenSwap}
            onClick={(event) => {
              event.stopPropagation();
              if (id === "technique") onOpenTechnique?.(event);
              if (id === "swap") onOpenSwap?.();
              if (id === "note") onOpenNote?.(event);
            }}
            onTouchStart={(event) => event.stopPropagation()}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>}
    </section>
  );
}
