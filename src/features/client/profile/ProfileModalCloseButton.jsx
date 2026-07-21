import { X } from "lucide-react";

export default function ProfileModalCloseButton({
  ariaLabel = "Закрыть окно",
  className,
  disabled = false,
  onClick,
  testId
}) {
  return (
    <button
      type="button"
      className={className}
      data-profile-modal-close="true"
      data-testid={testId}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
    >
      <X size={22} strokeWidth={2.1} aria-hidden="true" />
    </button>
  );
}
