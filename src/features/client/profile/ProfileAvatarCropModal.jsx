import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import styles from "./ProfileAvatarCropModal.module.css";

export default function ProfileAvatarCropModal({
  open,
  imageRef,
  source,
  size,
  zoom,
  offset,
  onClose,
  onImageLoad,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onZoomChange,
  onApply
}) {
  if (!open) {
    return null;
  }

  const baseScale = size.width && size.height
    ? Math.max(240 / size.width, 240 / size.height)
    : 1;

  const imageStyle = {
    "--profile-avatar-crop-image-width": size.width ? `${size.width * baseScale * zoom}px` : "auto",
    "--profile-avatar-crop-image-height": size.height ? `${size.height * baseScale * zoom}px` : "auto",
    "--profile-avatar-crop-image-transform": `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`
  };

  return (
    <div className={styles.overlay} data-testid="profile-avatar-crop-overlay" role="presentation" onClick={onClose}>
      <section
        className={styles.dialog}
        data-css-module-scope="profile-avatar-crop-modal"
        data-testid="profile-avatar-crop-dialog"
        role="dialog"
        aria-modal="true"
        data-modal-surface="true"
        aria-labelledby="profileAvatarCropTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <ClientPageHeader
          compact
          embedded
          className={styles.header}
          title="Область фото"
          titleId="profileAvatarCropTitle"
          scope="profile-avatar-crop-header"
          onBack={onClose}
          backTestId="profile-avatar-crop-close"
          backAriaLabel="Закрыть редактор аватара"
        />

        <div
          className={styles.viewport}
          data-testid="profile-avatar-crop-viewport"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          <img
            ref={imageRef}
            src={source}
            alt=""
            draggable="false"
            onLoad={onImageLoad}
            className={styles.image}
            style={imageStyle}
          />
          <div className={styles.mask} aria-hidden="true" />
        </div>

        <label className={styles.zoom} data-testid="profile-avatar-crop-zoom">
          <span>−</span>
          <input
            className={styles.range}
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(event) => onZoomChange(event.target.value)}
            aria-label="Масштаб аватара"
          />
          <span>＋</span>
        </label>

        <p className={styles.hint}>Перемещай фото пальцем, чтобы лицо оказалось внутри круга.</p>

        <div className={styles.actions} data-testid="profile-avatar-crop-actions">
          <button type="button" className={`${styles.actionButton} ${styles.secondaryButton}`} data-testid="profile-avatar-crop-cancel" onClick={onClose}>Отмена</button>
          <button type="button" className={styles.actionButton} data-testid="profile-avatar-crop-apply" onClick={onApply}>Готово</button>
        </div>
      </section>
    </div>
  );
}
