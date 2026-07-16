import FoodSearchOverlay from "./FoodSearchOverlay";
import NutritionMainContent from "./NutritionMainContent";
import NutritionPage from "./NutritionPage";
import NutritionUndoDeleteToast from "./NutritionUndoDeleteToast";

export default function NutritionPageView({
  pickerOpen,
  calendarOpen,
  activeMeal,
  renderBottomBar,
  headerProps,
  calendarProps,
  summaryProps,
  orbitProps,
  diaryProps,
  mealModalProps,
  planDetailsProps,
  overlayData,
  undoDeleteItem,
  onUndoDelete
}) {
  return (
    <NutritionPage>
      <NutritionMainContent
        visible={!pickerOpen}
        calendarOpen={calendarOpen}
        headerProps={headerProps}
        calendarProps={calendarProps}
        summaryProps={summaryProps}
        orbitProps={orbitProps}
        diaryProps={diaryProps}
        mealModalProps={mealModalProps}
        planDetailsProps={planDetailsProps}
      />

      <FoodSearchOverlay
        open={pickerOpen}
        selectedFood={overlayData?.selectedFood}
        barcodeOpen={overlayData?.barcodeOpen}
        headerProps={overlayData?.header}
        productProps={overlayData?.product}
        searchProps={overlayData?.search}
      />

      <NutritionUndoDeleteToast
        open={Boolean(undoDeleteItem)}
        onRestore={onUndoDelete}
      />

      {!pickerOpen && !calendarOpen && !activeMeal && renderBottomBar?.(
        "nutrition",
        { variant: "nutrition" }
      )}
    </NutritionPage>
  );
}
