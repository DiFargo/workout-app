import { fetchAuthorizedWithTimeout } from "./apiClient.js";

export async function requestEmptyProgramAssignmentDeletion(body, request = fetchAuthorizedWithTimeout) {
  const response = await request("/api/trainer-program-assignment-delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }, 20000);
  const result = await response.json();
  if (!response.ok) {
    throw Object.assign(new Error(result.message || "Не удалось удалить программу. Обновите историю и повторите попытку."), { status: response.status, code: result.error });
  }
  if (result.ok !== true || result.assignmentKey !== body.assignmentKey ||
      !Array.isArray(result.deletedWorkoutIds) || !result.deletedWorkoutIds.length ||
      result.deletedWorkoutIds.some((id) => typeof id !== "string" || !id || id.includes("/"))) {
    throw new Error("Сервер не подтвердил удаление. Обновите историю программ.");
  }
  return result;
}
