import FoodPhotoAiSearchProcess from "./FoodPhotoAiSearchProcess";
import FoodSearchBottomBar from "./FoodSearchBottomBar";
import FoodSearchHistoryNames from "./FoodSearchHistoryNames";
import FoodSearchInput from "./FoodSearchInput";
import FoodSearchResults from "./FoodSearchResults";
import NutritionCreateChoice from "./NutritionCreateChoice";
import NutritionPhotoAiPreview from "./NutritionPhotoAiPreview";
import NutritionPhotoNotFoundModal from "./NutritionPhotoNotFoundModal";

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
        visible={!photoAnalyzing && searchTab !== "my" && searchTab !== "recent" && !showRecentFoods && search.trim().length < 2}
        foods={recentFoods}
        onSelect={onHistorySelect}
      />

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

      <FoodSearchBottomBar
        createChoiceOpen={createChoiceOpen}
        searchTab={searchTab}
        onBack={onBack}
        onSearch={onSearchTabSelect}
        onPhoto={onPhotoSelect}
        onCreate={onCreateSelect}
        onMyProducts={onMyProductsSelect}
      />

      <NutritionCreateChoice
        open={createChoiceOpen}
        onCreateFood={onCreateFood}
        onCreateDish={onCreateDish}
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
