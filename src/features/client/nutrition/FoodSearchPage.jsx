import FoodPhotoAiSearchProcess from "./FoodPhotoAiSearchProcess";
import FoodSearchBottomBar from "./FoodSearchBottomBar";
import FoodSearchHistoryNames from "./FoodSearchHistoryNames";
import FoodSearchInput from "./FoodSearchInput";
import FoodSearchResults from "./FoodSearchResults";
import NutritionCreateChoice from "./NutritionCreateChoice";
import NutritionPhotoAiPreview from "./NutritionPhotoAiPreview";
import NutritionPhotoNotFoundModal from "./NutritionPhotoNotFoundModal";
import {
  getSearchHistoryName,
  getShortFoodName
} from "../../../utils/nutritionFoodPresentation";

const DEFAULT_RECENT_FOODS = [
  { id: "recent_banana", name: "Банан", icon: "🍌", calories: 89, portion: "100 г" },
  { id: "recent_flat_white", name: "Флет Уайт", icon: "☕", calories: 45, portion: "100 мл" },
  { id: "recent_cottage_cake", name: "Творожный торт", icon: "🍰", calories: 260, portion: "100 г" }
];

const EXTRA_DEFAULT_RECENT_FOODS = [
  { id: "recent_chicken_breast", name: "Куриная грудка", icon: "🍗", calories: 165, portion: "100 г" },
  { id: "recent_egg", name: "Яйцо куриное", icon: "🥚", calories: 70, portion: "1 шт" },
  { id: "recent_oatmeal", name: "Овсянка", icon: "🥣", calories: 389, portion: "100 г" },
  { id: "recent_buckwheat", name: "Гречка", icon: "🍚", calories: 343, portion: "100 г" },
  { id: "recent_cottage_cheese", name: "Творог 5%", icon: "🥛", calories: 121, portion: "100 г" },
  { id: "recent_avocado", name: "Авокадо", icon: "🥑", calories: 160, portion: "100 г" }
];

function FoodSearchModernLanding({
  recentFoods,
  onRecentFoodSelect,
  onSearchReset
}) {
  const seenRecentNames = new Set();
  const recentCards = [...recentFoods, ...DEFAULT_RECENT_FOODS, ...EXTRA_DEFAULT_RECENT_FOODS]
    .filter((food) => {
      const key = String(getSearchHistoryName(food) || food.name || food.id || "")
        .trim()
        .toLowerCase();

      if (!key || seenRecentNames.has(key)) {
        return false;
      }

      seenRecentNames.add(key);
      return true;
    })
    .slice(0, 6);

  return (
    <div className="foodSearchModernLanding">
      <section className="foodSearchModernSection foodSearchRecentSection">
        <div className="foodSearchModernSectionHeader">
          <h3>
            <span aria-hidden="true">↺</span>
            Недавние
          </h3>
          <button type="button" onClick={onSearchReset}>Очистить</button>
        </div>

        <div className="foodSearchRecentGrid">
          {recentCards.map((food, index) => {
            const name = getSearchHistoryName(food) || food.name || "Продукт";
            return (
              <button
                type="button"
                key={`${food.id || name}_${index}`}
                className="foodSearchRecentCard"
                onClick={() => onRecentFoodSelect(food)}
              >
                <span aria-hidden="true">{food.icon || "🍽️"}</span>
                <strong>{getShortFoodName(name)}</strong>
              </button>
            );
          })}
        </div>
      </section>

    </div>
  );
}

export default function FoodSearchPage({
  photoInputRef,
  search,
  searchTab,
  createChoiceOpen,
  showRecentFoods,
  recentFoods,
  photoAnalyzing,
  fatSecretError,
  fatSecretLoading,
  fallbackSuggestions,
  searchResults,
  visibleResults,
  nutrition,
  photoNotFoundOpen,
  photoPreview,
  photoConfidence,
  photoResult,
  selectedFood,
  photoCandidates,
  onSearchChange,
  onSearchReset,
  onHistorySelect,
  onRecentFoodSelect,
  onSuggestionSelect,
  onMyFoodSelect,
  onFoodSelect,
  onShowMore,
  onBack,
  onSearchTabSelect,
  onPhotoSelect,
  onCreateSelect,
  onMyProductsSelect,
  onCreateFood,
  onCreateDish,
  onPhotoInputChange,
  onPhotoNotFoundClose,
  onPhotoRetry,
  onPhotoAddManually,
  onPhotoCandidateSelect,
  onPhotoReset
}) {
  const isModernSearchHome = (
    searchTab !== "my" &&
    !createChoiceOpen &&
    !photoAnalyzing &&
    !fatSecretLoading &&
    !fatSecretError &&
    search.trim().length < 2
  );

  return (
    <>
      <FoodSearchInput
        value={search}
        onChange={onSearchChange}
        onReset={onSearchReset}
      />

      <FoodPhotoAiSearchProcess
        visible={photoAnalyzing && searchTab !== "my" && searchTab !== "recent"}
      />

      <FoodSearchHistoryNames
        visible={!isModernSearchHome && !photoAnalyzing && searchTab !== "my" && searchTab !== "recent" && !showRecentFoods && search.trim().length < 2}
        foods={recentFoods}
        onSelect={onHistorySelect}
      />

      {isModernSearchHome ? (
        <FoodSearchModernLanding
          recentFoods={recentFoods}
          onRecentFoodSelect={onRecentFoodSelect}
          onSearchReset={onSearchReset}
        />
      ) : (
        <FoodSearchResults
          search={search}
          searchTab={searchTab}
          showRecentFoods={showRecentFoods}
          recentFoods={recentFoods}
          photoAnalyzing={photoAnalyzing}
          fatSecretError={fatSecretError}
          fatSecretLoading={fatSecretLoading}
          fallbackSuggestions={fallbackSuggestions}
          searchResults={searchResults}
          visibleResults={visibleResults}
          nutrition={nutrition}
          onRecentFoodSelect={onRecentFoodSelect}
          onSuggestionSelect={onSuggestionSelect}
          onMyFoodSelect={onMyFoodSelect}
          onFoodSelect={onFoodSelect}
          onShowMore={onShowMore}
        />
      )}

      {!createChoiceOpen && searchTab !== "my" && (
        <button
          type="button"
          className="foodSearchFixedPhotoAction"
          onClick={onPhotoSelect}
          aria-label="ИИ поиск по фото"
        >
          <span className="foodSearchModernActionIcon" aria-hidden="true">📷</span>
          <span>
            <strong>ИИ поиск по фото</strong>
            <small>Сфотографируйте еду и получите КБЖУ</small>
          </span>
          <em aria-hidden="true">›</em>
        </button>
      )}

      <FoodSearchBottomBar
        createChoiceOpen={createChoiceOpen}
        searchTab={searchTab}
        onBack={onBack}
        onSearch={onSearchTabSelect}
        onCreate={onCreateSelect}
        onMyProducts={onMyProductsSelect}
      />

      <NutritionCreateChoice
        open={createChoiceOpen}
        onCreateFood={onCreateFood}
        onCreateDish={onCreateDish}
        onClose={onSearchTabSelect}
      />

      <input
        ref={photoInputRef}
        className="fatPhotoAiInput"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPhotoInputChange}
      />

      <NutritionPhotoNotFoundModal
        open={photoNotFoundOpen}
        onClose={onPhotoNotFoundClose}
        onRetry={onPhotoRetry}
        onAddManually={onPhotoAddManually}
      />

      <NutritionPhotoAiPreview
        preview={photoPreview}
        analyzing={photoAnalyzing}
        confidence={photoConfidence}
        result={photoResult}
        selectedFood={selectedFood}
        candidates={photoCandidates}
        onSelectCandidate={onPhotoCandidateSelect}
        onReset={onPhotoReset}
      />
    </>
  );
}
