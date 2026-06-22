export default function FoodSearchBottomBar({
  createChoiceOpen,
  searchTab,
  onBack,
  onSearch,
  onPhoto,
  onCreate,
  onMyProducts
}) {
  return (
    <div className="fatSearchBottomBar fatSearchBottomBarFive">
      <button
        type="button"
        className="fatSearchBackAction"
        onClick={onBack}
        aria-label="Назад к питанию"
      >
        <span>←</span>
        <strong>Назад к питанию</strong>
      </button>

      <button
        type="button"
        className={`fatSearchSearchAction ${!createChoiceOpen && searchTab !== "my" ? "active" : ""}`}
        onClick={onSearch}
      >
        <span>⌕</span>
        <strong>Поиск<br />еды</strong>
      </button>

      <button
        type="button"
        className="fatSearchPhotoAction"
        onClick={onPhoto}
        aria-label="Распознать еду по фото"
      >
        <span>📷</span>
        <strong>ИИ поиск</strong>
      </button>

      <button
        type="button"
        className={`fatSearchCreateAction ${createChoiceOpen ? "active" : ""}`}
        onClick={onCreate}
      >
        <span>＋</span>
        <strong>Создать<br />продукт</strong>
      </button>

      <button
        type="button"
        className={`fatSearchMyProductsAction ${!createChoiceOpen && searchTab === "my" ? "active" : ""}`}
        onClick={onMyProducts}
      >
        <span>💾</span>
        <strong>Мои продукты</strong>
      </button>
    </div>
  );
}
