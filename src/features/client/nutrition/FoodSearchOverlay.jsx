import FoodProductPage from "./FoodProductPage";
import FoodSearchHeader from "./FoodSearchHeader";
import FoodSearchPage from "./FoodSearchPage";
import NutritionBarcodeOverlay from "./NutritionBarcodeOverlay";

export default function FoodSearchOverlay({
  open,
  selectedFood,
  headerProps,
  productProps,
  searchProps,
  barcodeOpen
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fatFoodSearchOverlay">
      <section
        className="fatFoodSearchScreen fatFoodSearchScreenPremium"
        role="dialog"
        aria-modal="true"
        aria-label="Поиск еды"
      >
        <FoodSearchHeader {...headerProps} />

        {selectedFood ? (
          <FoodProductPage {...productProps} />
        ) : (
          <FoodSearchPage {...searchProps} />
        )}

        <NutritionBarcodeOverlay open={barcodeOpen} />
      </section>
    </div>
  );
}
