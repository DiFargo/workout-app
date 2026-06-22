export default function FoodPhotoAiSearchProcess({ visible }) {
  if (!visible) {
    return null;
  }

  return (
    <div className="fatPhotoAiSearchProcess">
      <div className="fatPhotoAiSearchOrbit" aria-hidden="true">
        <i />
        <span />
      </div>
      <div>
        <strong>ИИ ищет продукт по фото</strong>
        <p>Анализирую изображение, название, этикетку и порцию.</p>
      </div>
    </div>
  );
}
