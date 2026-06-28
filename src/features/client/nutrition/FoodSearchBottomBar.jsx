export default function FoodSearchBottomBar({
  createChoiceOpen,
  searchTab,
  onBack,
  onSearch,
  onCreate,
  onMyProducts
}) {
  return (
    <div className="fatSearchBottomBar fatSearchBottomBarFour">
      <button
        type="button"
        className="fatSearchBackAction"
        onClick={onBack}
        aria-label="Назад к питанию"
      >
        <span>←</span>
        <strong>Назад</strong>
      </button>

      <button
        type="button"
        className={`fatSearchSearchAction ${!createChoiceOpen && searchTab !== "my" ? "active" : ""}`}
        onClick={onSearch}
      >
        <span>⌕</span>
        <strong>Поиск</strong>
      </button>

      <button
        type="button"
        className={`fatSearchCreateAction ${createChoiceOpen ? "active" : ""}`}
        onClick={onCreate}
      >
        <span>＋</span>
        <strong>Создать</strong>
      </button>

      <button
        type="button"
        className={`fatSearchMyProductsAction ${!createChoiceOpen && searchTab === "my" ? "active" : ""}`}
        onClick={onMyProducts}
      >
        <span>▣</span>
        <strong>Мои</strong>
      </button>
    </div>
  );
}
