import Modal from "./Modal";
import styles from "./ConfirmDialog.module.css";

export default function ConfirmDialog({
  open,
  title,
  description,
  eyebrow,
  icon = "⌫",
  cancelLabel = "Отмена",
  confirmLabel = "Удалить",
  pending = false,
  danger = true,
  onCancel,
  onConfirm,
  showCloseButton = false,
  titleAs: Title = "h2",
  classNames = {},
  testIds = {}
}) {
  return (
    <Modal
      open={open}
      onClose={pending ? undefined : onCancel}
      closeOnBackdrop={!pending}
      closeOnEscape={!pending}
      ariaLabelledBy={testIds.titleId}
      classNames={{
        overlay: classNames.overlay,
        backdrop: classNames.backdrop,
        content: classNames.content
      }}
      testId={testIds.overlay}
      backdropTestId={testIds.backdrop}
      contentTestId={testIds.content}
    >
      {({ generatedLabelId }) => {
        const titleId = testIds.titleId || generatedLabelId;
        return (
          <>
            {showCloseButton ? (
              <button
                type="button"
                className={classNames.closeButton || styles.closeButton}
                data-testid={testIds.close}
                onClick={onCancel}
                disabled={pending}
                aria-label="Закрыть"
              >
                ×
              </button>
            ) : null}
            {eyebrow ? <span className={classNames.eyebrow || styles.eyebrow}>{eyebrow}</span> : null}
            {icon ? <span className={classNames.icon || styles.icon} aria-hidden="true">{icon}</span> : null}
            <Title className={classNames.title || styles.title} id={titleId}>{title}</Title>
            {description ? <div className={classNames.description || styles.description}>{description}</div> : null}
            <div className={classNames.actions || styles.actions}>
              <button
                className={classNames.action || styles.action}
                type="button"
                onClick={onCancel}
                disabled={pending}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                className={[
                  classNames.action || styles.action,
                  danger && (classNames.danger || styles.danger)
                ].filter(Boolean).join(" ")}
                onClick={onConfirm}
                disabled={pending}
              >
                {confirmLabel}
              </button>
            </div>
          </>
        );
      }}
    </Modal>
  );
}
