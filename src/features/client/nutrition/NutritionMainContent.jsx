import NutritionCalendarModal from "./NutritionCalendarModal";
import NutritionDiary from "./NutritionDiary";
import NutritionHeader from "./NutritionHeader";
import NutritionMealModal from "./NutritionMealModal";
import NutritionOrbit from "./NutritionOrbit";
import NutritionPlanDetails from "./NutritionPlanDetails";
import NutritionSummary from "./NutritionSummary";
import NutritionSyncRecovery from "./NutritionSyncRecovery.jsx";
import styles from "./NutritionMainContent.module.css";

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

      <div className={styles.layout}>
        <div className={styles.summary}>
          <NutritionOrbit {...orbitProps} saveStatus={<NutritionSyncRecovery {...syncRecoveryProps} />} />
        </div>
        <div className={styles.diary}>
          <NutritionDiary {...diaryProps} />
          <NutritionSummary {...summaryProps} />
        </div>
      </div>

      <NutritionMealModal {...mealModalProps} />

      <NutritionPlanDetails {...planDetailsProps} />
    </>
  );
}
