import { ChevronLeft } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import styles from "./ClientPageHeader.module.css";

export default function ClientPageHeader({
  title,
  titleId,
  titlePart,
  titleProps,
  titleTestId,
  eyebrow,
  onBack,
  backLabel = "Назад",
  backAriaLabel,
  backDisabled = false,
  backTestId,
  backAction,
  backProps,
  actions,
  children,
  barPart,
  barTestId,
  className = "",
  compact = false,
  controlsVariant = "default",
  embedded = false,
  frameClassName = "",
  extensionClassName = "",
  rootProps,
  scope,
  testId,
  titleAlign = "center",
  primary = false
}) {
  const frameRef = useRef(null);
  const headerRef = useRef(null);

  useLayoutEffect(() => {
    if (embedded) return undefined;

    const frame = frameRef.current;
    const header = headerRef.current;
    if (!frame || !header) return undefined;

    let animationFrame = 0;
    const syncFrame = () => {
      const frameRect = frame.getBoundingClientRect();
      const headerStyle = window.getComputedStyle(header);
      const marginTop = Number.parseFloat(headerStyle.marginTop) || 0;
      const marginBottom = Number.parseFloat(headerStyle.marginBottom) || 0;
      const reservedHeight = Math.ceil(header.offsetHeight + marginTop + marginBottom);

      frame.style.setProperty("--client-page-header-height", `${reservedHeight}px`);
      frame.style.setProperty("--client-page-header-width", `${frameRect.width}px`);
      frame.style.setProperty("--client-page-header-left", `${frameRect.left}px`);
      frame.style.setProperty("--client-page-header-transform", "none");
    };
    const scheduleSync = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(syncFrame);
    };

    syncFrame();
    const resizeObserver = new ResizeObserver(scheduleSync);
    resizeObserver.observe(frame);
    resizeObserver.observe(header);
    window.addEventListener("resize", scheduleSync);
    window.addEventListener("orientationchange", scheduleSync);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleSync);
      window.removeEventListener("orientationchange", scheduleSync);
    };
  }, [embedded]);

  return (
    <div
      ref={frameRef}
      className={`${styles.frame} ${embedded ? styles.embeddedFrame : ""} ${frameClassName}`.trim()}
      data-client-page-header-frame="true"
    >
      <header
        className={`${styles.root} ${compact ? styles.compact : styles.large} ${controlsVariant === "workout" ? styles.workoutControls : ""} ${titleAlign === "start" ? styles.startTitle : ""} ${primary ? styles.primary : ""} ${embedded ? styles.embedded : ""} ${className}`.trim()}
        data-client-page-header="true"
        data-client-page-header-controls={controlsVariant}
        data-client-page-header-layout={embedded ? "embedded" : "screen"}
        data-css-module-scope={scope}
        data-testid={testId}
        {...rootProps}
        ref={headerRef}
      >
        <div
          className={styles.bar}
          data-testid={barTestId}
          data-nutrition-header-part={barPart}
        >
          {onBack ? (
            <button
              type="button"
              className={styles.back}
              data-testid={backTestId}
              data-food-edit-page-action={backAction}
              aria-label={backAriaLabel || backLabel}
              disabled={backDisabled}
              onClick={onBack}
              {...backProps}
            >
              <ChevronLeft aria-hidden="true" />
              <span>{backLabel}</span>
            </button>
          ) : null}

          <div className={styles.heading}>
            {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
            <h1
              className={styles.title}
              id={titleId}
              data-testid={titleTestId}
              data-nutrition-header-part={titlePart}
              {...titleProps}
            >
              {title}
            </h1>
          </div>

          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </div>

        {children ? <div className={`${styles.extension} ${extensionClassName}`.trim()}>{children}</div> : null}
      </header>
    </div>
  );
}
