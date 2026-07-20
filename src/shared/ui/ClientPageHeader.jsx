import { ChevronLeft } from "lucide-react";
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
  embedded = false,
  rootProps,
  scope,
  testId
}) {
  return (
    <header
      className={`${styles.root} ${compact ? styles.compact : styles.large} ${embedded ? styles.embedded : ""} ${className}`.trim()}
      data-client-page-header="true"
      data-client-page-header-layout={embedded ? "embedded" : "screen"}
      data-css-module-scope={scope}
      data-testid={testId}
      {...rootProps}
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

      {children ? <div className={styles.extension}>{children}</div> : null}
    </header>
  );
}
