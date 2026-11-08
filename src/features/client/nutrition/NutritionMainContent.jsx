import NutritionCalendarModal from "./NutritionCalendarModal";
import NutritionDiary from "./NutritionDiary";
import NutritionHeader from "./NutritionHeader";
import NutritionMealModal from "./NutritionMealModal";
import NutritionOrbit from "./NutritionOrbit";
import NutritionPlanDetails from "./NutritionPlanDetails";
import NutritionSummary from "./NutritionSummary";
import NutritionSyncRecovery from "./NutritionSyncRecovery.jsx";

export default function NutritionMainContent({
  visible,
  calendarOpen,
  headerProps,
  calendarProps,
  summaryProps,
  orbitProps,
  diaryProps,
  mealModalProps,
  planDetailsProps,
  syncRecoveryProps
}) {
  if (!visible) {
    return null;
  }

  return (
    <>
      <NutritionHeader {...headerProps} onOpenCalendar={orbitProps?.onOpenCalendar} />

      {calendarOpen && (
        <NutritionCalendarModal {...calendarProps} />
      )}

      <NutritionOrbit {...orbitProps} saveStatus={<NutritionSyncRecovery {...syncRecoveryProps} />} />

      <NutritionDiary {...diaryProps} />

      <NutritionSummary {...summaryProps} />

      <NutritionMealModal {...mealModalProps} />

      <NutritionPlanDetails {...planDetailsProps} />
    </>
  );
}
