import FoodSearchOverlay from "./FoodSearchOverlay";
import NutritionMainContent from "./NutritionMainContent";
import NutritionPage from "./NutritionPage";
import NutritionUndoDeleteToast from "./NutritionUndoDeleteToast";
import NutritionDeleteConfirmModal from "./NutritionDeleteConfirmModal";

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
  onUndoDelete,
  deleteConfirmProps,
  syncRecoveryProps
}) {
  return (
    <NutritionPage>
      <NutritionMainContent
        visible
        calendarOpen={calendarOpen}
        headerProps={headerProps}
        calendarProps={calendarProps}
        summaryProps={summaryProps}
        orbitProps={orbitProps}
        diaryProps={diaryProps}
        mealModalProps={mealModalProps}
        planDetailsProps={planDetailsProps}
        syncRecoveryProps={syncRecoveryProps}
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
        open={Boolean(undoDeleteItem) && !activeMeal && !diaryProps?.nutritionZoukExpanded}
        onRestore={onUndoDelete}
      />
      <NutritionDeleteConfirmModal {...deleteConfirmProps} />

      {!pickerOpen && !calendarOpen && !activeMeal && renderBottomBar?.(
        "nutrition",
        { variant: "nutrition" }
      )}
    </NutritionPage>
  );
}
