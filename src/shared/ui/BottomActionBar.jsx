import styles from "./BottomActionBar.module.css";

function joinClassNames(...values) {
  return values.filter(Boolean).join(" ");
}

export default function BottomActionBar({
  hidden = false,
  items,
  ariaLabel = "Действия",
  className,
  buttonClassName,
  activeClassName,
  testId,
  scope = "bottom-action-bar"
}) {
  if (hidden) return null;

  return (
    <nav
      className={className || styles.root}
      aria-label={ariaLabel}
      data-css-module-scope={scope}
      data-testid={testId}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            className={joinClassNames(buttonClassName || styles.button, item.active && (activeClassName || styles.active))}
            data-action={item.id}
            disabled={item.disabled}
            onClick={item.onClick}
          >
            {Icon ? <span aria-hidden="true">{typeof Icon === "string" ? Icon : <Icon />}</span> : null}
            <strong>{item.label}</strong>
          </button>
        );
      })}
    </nav>
  );
}
