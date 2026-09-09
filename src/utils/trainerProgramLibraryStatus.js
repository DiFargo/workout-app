import { getTrainerProgramStatusMeta } from "./trainerProgramLifecycle.js";

export function getProgramLibraryStatusMeta(program = {}, assignedClientCount = 0) {
  const status = getTrainerProgramStatusMeta(program);

  if (status.id === "draft") {
    return {
      ...status,
      label: "Черновик",
      description: "Не назначается клиентам, пока не подготовлена"
    };
  }

  if (status.id === "archived") {
    return { ...status, label: "Архив", description: "Программу нельзя назначить клиенту" };
  }

  if (assignedClientCount > 0) {
    return { ...status, tone: "used", label: "Используется", description: "Программа назначена одному или нескольким клиентам" };
  }

  return {
    ...status,
    tone: "ready",
    label: "Готова к назначению",
    description: "Программу можно назначать клиентам"
  };
}

