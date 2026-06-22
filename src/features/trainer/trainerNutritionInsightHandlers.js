import {
  buildAdminNutritionDaysList,
  buildAdminNutritionRecommendations
} from "../../utils/trainerNutritionInsights";
import { buildAdminClientCsvLines } from "../../utils/trainerClientExport";
import { getAdminClientProfile } from "../../utils/adminClientProfile";

const STATUS_SELECT_CLIENT = "\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0432\u044b\u0431\u0435\u0440\u0438 \u043a\u043b\u0438\u0435\u043d\u0442\u0430.";

export function createTrainerNutritionInsightHandlers({
  adminClientHistory,
  adminSelectedClient,
  adminClientNutrition,
  defaultNutritionState,
  buildDayModel,
  setAdminClientStatus
}) {
  function getAdminNutritionDaysList(nutritionState = null) {
    return buildAdminNutritionDaysList(nutritionState, {
      history: adminClientHistory,
      defaultNutritionState,
      buildDayModel
    });
  }

  function getAdminRecommendations(client, historyList, nutritionState) {
    const days = getAdminNutritionDaysList(nutritionState);
    return buildAdminNutritionRecommendations({
      profile: getAdminClientProfile(client),
      historyList,
      nutritionState,
      days,
      defaultProteinGoal: defaultNutritionState.goals.protein
    });
  }

  function exportAdminClientCsv() {
    if (!adminSelectedClient) {
      setAdminClientStatus(STATUS_SELECT_CLIENT);
      return;
    }

    const nutritionDays = getAdminNutritionDaysList(adminClientNutrition);
    const rows = buildAdminClientCsvLines(adminClientHistory, nutritionDays);

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${adminSelectedClient.email || adminSelectedClient.name || "client"}-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return {
    getAdminNutritionDaysList,
    getAdminRecommendations,
    exportAdminClientCsv
  };
}
