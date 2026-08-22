import FoodPhotoAiSearchProcess from "./FoodPhotoAiSearchProcess";
import FoodSearchBottomBar from "./FoodSearchBottomBar";
import FoodSearchHistoryNames from "./FoodSearchHistoryNames";
import FoodSearchInput from "./FoodSearchInput";
import FoodSearchResults from "./FoodSearchResults";
import NutritionCreateChoice from "./NutritionCreateChoice";
import NutritionPhotoAiPreview from "./NutritionPhotoAiPreview";
import NutritionPhotoNotFoundModal from "./NutritionPhotoNotFoundModal";
import { Package, Plus } from "lucide-react";
import styles from "./FoodSearchPage.module.css";
import {
  getSearchHistoryName,
  getShortFoodName
} from "../../../utils/nutritionFoodPresentation";

function FoodSearchModernLanding({
  recentFoods,
  onRecentFoodSelect
}) {
  const seenRecentNames = new Set();
  const recentCards = (Array.isArray(recentFoods) ? recentFoods : [])
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
    <div
      className={styles.landing}
      data-testid="food-search-modern-landing"
      data-css-module-scope="food-search-page"
    >
      <section data-testid="food-search-recent-section">
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>
            <span className={styles.sectionIcon} aria-hidden="true">↺</span>
            Недавние
          </h3>
        </div>

        {recentCards.length > 0 ? (
          <div className={styles.recentGrid} data-testid="food-search-recent-grid">
            {recentCards.map((food, index) => {
              const name = getSearchHistoryName(food) || food.name || "Продукт";
              return (
                <button
                  type="button"
                  key={`${food.id || name}_${index}`}
                  className={styles.recentItem}
                  data-food-search-recent-card
                  data-css-module-control="food-search-recent-card"
                  onClick={() => onRecentFoodSelect(food)}
                >
                  <span className={styles.recentIcon} aria-hidden="true">{food.icon || "🍽️"}</span>
                  <strong className={styles.recentName}>{getShortFoodName(name)}</strong>
                </button>
              );
            })}
          </div>
        ) : (
          <p className={styles.emptyRecent} data-testid="food-search-empty-recents">
            Добавленные вами продукты появятся здесь.
          </p>
        )}
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
  onCreateSelect,
  onMyProductsSelect,
  onCreateFood,
  onCreateDish,
  onPhotoInputChange,
  onPhotoNotFoundClose,
  onPhotoRetry,
  onPhotoAddManually,
  onPhotoCandidateSelect,
  onPhotoReset,
  modal = false
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
      <div
        className={`${styles.content}${modal ? ` ${styles.modalContent}` : ""}`}
        data-testid={modal ? "food-search-scroll" : undefined}
      >
        <FoodSearchInput
          value={search}
          onChange={onSearchChange}
          onReset={onSearchReset}
          variant={searchTab === "my" ? "my-products" : "search"}
        />

        {searchTab === "my" && !createChoiceOpen && (
          <button
            type="button"
            className={styles.createInMy}
            data-testid="food-search-create-in-my"
            data-css-module-control="food-search-create-in-my"
            onClick={onCreateSelect}
          >
            <Plus aria-hidden="true" />
            <span>
              <strong>Создать продукт или блюдо</strong>
              <small>Добавить в «Мою базу»</small>
            </span>
          </button>
        )}

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
          />
        ) : (
          <FoodSearchResults
            search={search}
            searchTab={searchTab}
            photoAnalyzing={photoAnalyzing}
            fatSecretError={fatSecretError}
            fatSecretLoading={fatSecretLoading}
            fallbackSuggestions={fallbackSuggestions}
            searchResults={searchResults}
            visibleResults={visibleResults}
            nutrition={nutrition}
            onSuggestionSelect={onSuggestionSelect}
            onMyFoodSelect={onMyFoodSelect}
            onFoodSelect={onFoodSelect}
            onShowMore={onShowMore}
          />
        )}
      </div>

      {!createChoiceOpen && (
        <button
          type="button"
          className={`${styles.photoAction}${modal ? ` ${styles.modalPhotoAction}` : ""} ${styles.myProductsAction}`}
          data-testid="food-search-my-products-action"
          data-css-module-scope="food-search-page"
          data-css-module-control="food-search-my-products-action"
          onClick={searchTab === "my" ? onSearchTabSelect : onMyProductsSelect}
          aria-label={searchTab === "my" ? "Вернуться к поиску" : "Мои продукты"}
        >
          <span className={styles.photoIcon} aria-hidden="true"><Package /></span>
          <span className={styles.photoCopy}>
            <strong className={styles.photoTitle}>{searchTab === "my" ? "Вернуться к поиску" : "Мои продукты"}</strong>
            <small className={styles.photoDescription}>
              {searchTab === "my" ? "Найти продукт в общей базе" : "Ваша личная база продуктов и блюд"}
            </small>
          </span>
          <em className={styles.photoChevron} aria-hidden="true">›</em>
        </button>
      )}

      {!modal && (
        <FoodSearchBottomBar
          searchTab={searchTab}
          onBack={onBack}
          onSearch={onSearchTabSelect}
          onMyProducts={onMyProductsSelect}
        />
      )}

      <NutritionCreateChoice
        open={createChoiceOpen}
        onCreateFood={onCreateFood}
        onCreateDish={onCreateDish}
        onClose={searchTab === "my" ? onMyProductsSelect : onSearchTabSelect}
      />

      <input
        ref={photoInputRef}
        className={styles.photoInput}
        data-testid="food-search-photo-input"
        data-css-module-control="food-search-photo-input"
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
