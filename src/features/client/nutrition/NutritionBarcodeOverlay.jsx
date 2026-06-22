export default function NutritionBarcodeOverlay({ open }) {
  if (!open) {
    return null;
  }

  return (
    <div className="fatBarcodeOverlay fatBarcodeScreen">
      <div className="fatBarcodeCard">
        <div className="fatBarcodeHeader">
          <span>Скоро</span>
          <h3>Штрихкод</h3>
          <p>Мы готовим базу продуктов, чтобы поиск по упаковке был точным и быстрым.</p>
        </div>
        <div className="fatBarcodePlaceholder">
          <span aria-hidden="true">▦</span>
          <strong>Поиск по штрихкоду появится позже</strong>
          <p>Сейчас добавь продукт через обычный поиск, ИИ-фото или кнопку «Создать».</p>
        </div>
      </div>
    </div>
  );
}
