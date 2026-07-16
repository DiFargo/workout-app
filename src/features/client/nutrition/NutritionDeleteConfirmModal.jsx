import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import styles from "./NutritionDeleteConfirmModal.module.css";

export default function NutritionDeleteConfirmModal({
  open,
  foodName,
  onCancel,
  onConfirm
}) {
  return (
    <ConfirmDialog
      open={open}
      title="Удалить из моей базы?"
      description={<>«{foodName || "Продукт"}» будет удалён без возможности восстановления.</>}
      onCancel={onCancel}
      onConfirm={onConfirm}
      showCloseButton
      classNames={{
        overlay: styles.overlay,
        backdrop: styles.backdrop,
        content: styles.card,
        closeButton: styles.closeButton,
        icon: styles.icon,
        title: styles.title,
        description: styles.description,
        actions: styles.actions,
        action: styles.actionButton,
        danger: styles.dangerAction
      }}
      testIds={{
        overlay: "nutrition-delete-confirm-modal",
        backdrop: "nutrition-delete-confirm-backdrop",
        close: "nutrition-delete-confirm-close",
        titleId: "nutrition-delete-title"
      }}
    />
  );
}
