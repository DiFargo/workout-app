import { doc, setDoc } from "firebase/firestore";

import { defaultNutritionState } from "../../data/nutritionDefaults";
import { db } from "../../firebase";
import { showAppConfirm } from "../../utils/appFeedback";

const NUTRITION_PRESET_MAP = {
  maintenance: { name: "Поддержка", goal: "Поддержание веса и формы", calories: 2400, protein: 160, fat: 75, carbs: 260 },
  recomposition: { name: "Рекомпозиция", goal: "Снижение жира и сохранение мышц", calories: 2300, protein: 180, fat: 70, carbs: 235 },
  fat_loss: { name: "Похудение", goal: "Плавное снижение веса", calories: 2100, protein: 170, fat: 65, carbs: 190 },
  cutting: { name: "Сушка", goal: "Снижение процента жира", calories: 1900, protein: 185, fat: 55, carbs: 160 },
  mass_gain: { name: "Набор", goal: "Набор мышечной массы", calories: 2850, protein: 180, fat: 85, carbs: 340 }
};

export default function TrainerClientTrainingTab({
  adminSelectedNutritionPreset,
  adminSelectedTemplateId,
  adminTrainingTemplates,
  assignSavedProgramToClient,
  clearClientProgram,
  loadWorkoutsFromFirebase,
  selectedClient,
  setAdminClientStatus,
  setAdminSelectedClient,
  setAdminSelectedNutritionPreset,
  setAdminSelectedTemplateId,
  setPage,
  setSelectedUserId,
  setUsersList,
  trainerWorkoutsPage,
  saveTrainerClientNutritionPlan
}) {
  async function resetClientNutritionPlan() {
    const confirmed = await showAppConfirm("Сбросить назначенный план питания клиента?");
    if (!confirmed) return;

    try {
      const defaultGoals = {
        calories: defaultNutritionState.goals.calories,
        protein: defaultNutritionState.goals.protein,
        fat: defaultNutritionState.goals.fat,
        carbs: defaultNutritionState.goals.carbs
      };

      await setDoc(doc(db, "users", selectedClient.id), {
        nutritionGoals: defaultGoals,
        nutritionPlan: null,
        aiNutritionPlan: null
      }, { merge: true });

      setAdminSelectedClient((prev) => prev?.id === selectedClient.id ? {
        ...prev,
        nutritionGoals: defaultGoals,
        nutritionPlan: null,
        aiNutritionPlan: null
      } : prev);

      setUsersList((prev) => prev.map((client) => client.id === selectedClient.id ? {
        ...client,
        nutritionGoals: defaultGoals,
        nutritionPlan: null,
        aiNutritionPlan: null
      } : client));

      setAdminClientStatus("План питания сброшен.");
    } catch (error) {
      console.error("Nutrition plan reset error:", error);
      setAdminClientStatus("Не получилось сбросить план питания.");
    }
  }

  async function assignNutritionPreset() {
    const selectedNutritionPreset = NUTRITION_PRESET_MAP[adminSelectedNutritionPreset] || NUTRITION_PRESET_MAP.maintenance;
    await saveTrainerClientNutritionPlan({
      ...selectedNutritionPreset,
      presetId: adminSelectedNutritionPreset
    });
  }

  return (
    <div className="adminClientTabContent adminProgramClientTab">
      <div className="adminProgramAssignGrid">
        <div className="adminAssignProgramPanel adminProgramAssignCard">
          <div className="adminAssignProgramHead">
            <div>
              <span>TRAINING PROGRAM</span>
              <h3>Программа тренировок</h3>
              <p>Выбери готовую программу из библиотеки и назначь её клиенту.</p>
            </div>

            <button onClick={() => {
              setSelectedUserId(selectedClient.id);
              loadWorkoutsFromFirebase(selectedClient.id);
              setPage(trainerWorkoutsPage);
            }}>
              Редактор
            </button>
          </div>

          <div className="adminCurrentProgramBadge">
            <span>Сейчас назначено</span>
            <strong>{selectedClient.assignedProgramName || "Не назначено"}</strong>
          </div>

          <div className="adminSavedProgramsGrid adminSavedProgramsGridCompact">
            {adminTrainingTemplates.map((template) => {
              const isSelected = adminSelectedTemplateId === template.id;
              const isAssigned = selectedClient.assignedProgramId === template.id;

              return (
                <button
                  key={template.id}
                  className={isSelected || isAssigned ? "adminSavedProgramCard active" : "adminSavedProgramCard"}
                  onClick={() => setAdminSelectedTemplateId(template.id)}
                >
                  <span>{isAssigned ? "Назначена" : "Готовая программа"}</span>
                  <strong>{template.name}</strong>
                  <small>{template.workouts?.length || 0} трен. · {(template.workouts || []).reduce((sum, workout) => sum + (workout.exercises?.length || 0), 0)} упр.</small>
                  <em>{isSelected ? "Выбрана" : "Выбрать"}</em>
                </button>
              );
            })}

            {!adminTrainingTemplates.length && (
              <div className="adminNoSavedPrograms">
                <strong>Сохранённых программ пока нет</strong>
                <p>Открой редактор программы, создай программу и сохрани её как шаблон.</p>
              </div>
            )}
          </div>

          <div className="adminAssignProgramActions adminAssignProgramActionsCompact">
            <select value={adminSelectedTemplateId} onChange={(event) => setAdminSelectedTemplateId(event.target.value)}>
              <option value="">Выбери сохранённую программу</option>
              {adminTrainingTemplates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>

            <div className="adminVisibleAssignActions">
              <button onClick={() => assignSavedProgramToClient(selectedClient.id)}>
                Назначить программу
              </button>

              <button
                type="button"
                className="adminClearTemplateButtonVisible"
                onClick={() => clearClientProgram(selectedClient.id)}
              >
                Сбросить
              </button>
            </div>
          </div>
        </div>

        <div className="adminAssignProgramPanel adminNutritionAssignCard">
          <div className="adminAssignProgramHead">
            <div>
              <span>NUTRITION PLAN</span>
              <h3>План питания</h3>
              <p>Назначь клиенту целевые калории и белок. Эти данные используются в календаре питания.</p>
            </div>
          </div>

          <label className="adminNutritionPlanSelect">
            <span>Вариант плана</span>
            <select
              value={adminSelectedNutritionPreset}
              onChange={(event) => setAdminSelectedNutritionPreset(event.target.value)}
            >
              <option value="maintenance">Поддержка · 2400 ккал · Б 160</option>
              <option value="recomposition">Рекомпозиция · 2300 ккал · Б 180</option>
              <option value="fat_loss">Похудение · 2100 ккал · Б 170</option>
              <option value="cutting">Сушка · 1900 ккал · Б 185</option>
              <option value="mass_gain">Набор · 2850 ккал · Б 180</option>
            </select>
          </label>

          <button
            type="button"
            className="adminNutritionAssignButton"
            onClick={assignNutritionPreset}
          >
            Назначить план питания
          </button>

          <button
            type="button"
            className="adminNutritionAssignButton ghost"
            onClick={resetClientNutritionPlan}
          >
            Сбросить
          </button>
        </div>
      </div>
    </div>
  );
}
