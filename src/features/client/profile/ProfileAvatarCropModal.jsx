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
    width: size.width ? `${size.width * baseScale * zoom}px` : "auto",
    height: size.height ? `${size.height * baseScale * zoom}px` : "auto",
    transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`
  };

  return (
    <div className="profileAvatarCropOverlay" role="presentation" onClick={onClose}>
      <section
        className="profileAvatarCropModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profileAvatarCropTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>АВАТАР</span>
            <h2 id="profileAvatarCropTitle">Выбери область фото</h2>
          </div>
          <button type="button" aria-label="Закрыть редактор аватара" onClick={onClose}>×</button>
        </header>

        <div
          className="profileAvatarCropViewport"
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
            style={imageStyle}
          />
          <div className="profileAvatarCropMask" aria-hidden="true" />
        </div>

        <label className="profileAvatarCropZoom">
          <span>−</span>
          <input
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

        <p>Перемещай фото пальцем, чтобы лицо оказалось внутри круга.</p>

        <div className="profileAvatarCropActions">
          <button type="button" className="secondary" onClick={onClose}>Отмена</button>
          <button type="button" onClick={onApply}>Готово</button>
        </div>
      </section>
    </div>
  );
}
