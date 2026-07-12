import {
  ClientMainBottomBar,
  TrainerWorkspaceBottomBar
} from "../../shared/ui/BottomBar";

export function renderClientMainBottomBar({
  activeTab,
  isTrainerMode,
  onGoMain,
  onOpenTraining,
  onOpenNutrition,
  onOpenCabinet,
  onPreloadMain,
  onPreloadTraining,
  onPreloadNutrition,
  onPreloadCabinet,
  onOpenTrainerClients,
  onOpenTrainerPrograms,
  onLoadTrainerCabinet,
  ...additionalProps
}) {
  return (
    <ClientMainBottomBar
      activeTab={activeTab}
      isTrainerMode={isTrainerMode}
      onGoMain={onGoMain}
      onOpenTraining={onOpenTraining}
      onOpenNutrition={onOpenNutrition}
      onOpenCabinet={onOpenCabinet}
      onPreloadMain={onPreloadMain}
      onPreloadTraining={onPreloadTraining}
      onPreloadNutrition={onPreloadNutrition}
      onPreloadCabinet={onPreloadCabinet}
      onOpenTrainerClients={onOpenTrainerClients}
      onOpenTrainerPrograms={onOpenTrainerPrograms}
      onLoadTrainerCabinet={onLoadTrainerCabinet}
      {...additionalProps}
    />
  );
}

export function renderTrainerMainBottomBar(props) {
  return renderClientMainBottomBar(props);
}

export function renderTrainerWorkspaceBottomBar({
  activeTab,
  onGoMain,
  onOpenTrainerClients,
  onOpenTrainerPrograms,
  onLoadTrainerCabinet,
  ...additionalProps
}) {
  return (
    <TrainerWorkspaceBottomBar
      activeTab={activeTab}
      onGoMain={onGoMain}
      onOpenTrainerClients={onOpenTrainerClients}
      onOpenTrainerPrograms={onOpenTrainerPrograms}
      onLoadTrainerCabinet={onLoadTrainerCabinet}
      {...additionalProps}
    />
  );
}
