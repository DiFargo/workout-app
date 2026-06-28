import NutritionCalendarModal from "./NutritionCalendarModal";
import NutritionDiary from "./NutritionDiary";
import NutritionHeader from "./NutritionHeader";
import NutritionMealModal from "./NutritionMealModal";
import NutritionOrbit from "./NutritionOrbit";
import NutritionPlanDetails from "./NutritionPlanDetails";
import NutritionSummary from "./NutritionSummary";

export default function NutritionMainContent({
  visible,
  calendarOpen,
  headerProps,
  calendarProps,
  summaryProps,
  orbitProps,
  diaryProps,
  mealModalProps,
  planDetailsProps
}) {
  if (!visible) {
    return null;
  }

  return (
    <>
      <NutritionHeader {...headerProps} />

      {calendarOpen && (
        <NutritionCalendarModal {...calendarProps} />
      )}

      <NutritionOrbit {...orbitProps} />

      <NutritionDiary {...diaryProps} />

      <NutritionSummary {...summaryProps} />

      <NutritionMealModal {...mealModalProps} />

      <NutritionPlanDetails {...planDetailsProps} />
    </>
  );
}
