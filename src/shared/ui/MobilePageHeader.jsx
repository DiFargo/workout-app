import styles from "./MobilePageHeader.module.css";

export default function MobilePageHeader({
  title,
  leading = null,
  actions = null,
  titleAs: Title = "div",
  className,
  titleClassName,
  actionsClassName
}) {
  return (
    <header
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-css-module-scope="mobile-page-header"
    >
      {leading || <span className={styles.spacer} aria-hidden="true" />}
      <Title className={[styles.title, titleClassName].filter(Boolean).join(" ")}>{title}</Title>
      {actions ? <div className={[styles.actions, actionsClassName].filter(Boolean).join(" ")}>{actions}</div> : <span className={styles.spacer} aria-hidden="true" />}
    </header>
  );
}
