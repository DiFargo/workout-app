export default function FoodSearchBottomBar({
  createChoiceOpen,
  searchTab,
  onBack,
  onSearch,
  onCreate,
  onMyProducts
}) {
  const searchActive = !createChoiceOpen && searchTab !== "my";
  const createActive = createChoiceOpen;
  const myProductsActive = !createChoiceOpen && searchTab === "my";

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
        className={`fatSearchSearchAction ${searchActive ? "active" : ""}`}
        aria-pressed={searchActive}
        onClick={onSearch}
      >
        <span>⌕</span>
        <strong>Поиск</strong>
      </button>

      <button
        type="button"
        className={`fatSearchCreateAction ${createActive ? "active" : ""}`}
        aria-pressed={createActive}
        onClick={onCreate}
      >
        <span>＋</span>
        <strong>Создать</strong>
      </button>

      <button
        type="button"
        className={`fatSearchMyProductsAction ${myProductsActive ? "active" : ""}`}
        aria-pressed={myProductsActive}
        onClick={onMyProducts}
      >
        <span>▣</span>
        <strong>Мои</strong>
      </button>
    </div>
  );
}
