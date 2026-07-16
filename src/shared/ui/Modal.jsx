import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import styles from "./Modal.module.css";

export default function Modal({
  open,
  children,
  onClose,
  closeOnBackdrop = true,
  closeOnEscape = true,
  ariaLabel,
  ariaLabelledBy,
  classNames = {},
  testId,
  backdropTestId,
  contentTestId,
  contentAs: Content = "section",
  portalTarget,
  portal = true
}) {
  const generatedLabelId = useId();

  useEffect(() => {
    if (!open || !closeOnEscape || !onClose) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeOnEscape, onClose, open]);

  if (!open || typeof document === "undefined") return null;

  const content = (
    <div
      className={classNames.overlay || styles.overlay}
      data-testid={testId}
      data-css-module-scope="shared-modal"
      role="presentation"
    >
      <button
        type="button"
        className={classNames.backdrop || styles.backdrop}
        data-testid={backdropTestId}
        aria-label="Закрыть окно по фону"
        tabIndex={-1}
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <Content
        className={classNames.content || styles.content}
        data-testid={contentTestId}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : ariaLabelledBy || generatedLabelId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {typeof children === "function"
          ? children({ generatedLabelId })
          : children}
      </Content>
    </div>
  );

  return portal ? createPortal(content, portalTarget || document.body) : content;
}
