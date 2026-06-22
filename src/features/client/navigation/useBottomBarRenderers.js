import {
  renderClientMainBottomBar as renderClientMainBottomBarInternal,
  renderTrainerMainBottomBar as renderTrainerMainBottomBarInternal,
  renderTrainerWorkspaceBottomBar as renderTrainerWorkspaceBottomBarInternal
} from "../../../components/navigation/bottomBarRenderers";

export function createBottomBarRenderers({
  isTrainerMode,
  onGoMain,
  onOpenTraining,
  onOpenNutrition,
  onOpenCabinet,
  onOpenTrainerClients,
  onOpenTrainerPrograms,
  onLoadTrainerCabinet
}) {
  return {
    renderClientMainBottomBar(activeTab, additionalProps = {}) {
      return renderClientMainBottomBarInternal({
        activeTab,
        isTrainerMode,
        onGoMain,
        onOpenTraining,
        onOpenNutrition,
        onOpenCabinet,
        onOpenTrainerClients,
        onOpenTrainerPrograms,
        onLoadTrainerCabinet,
        ...additionalProps
      });
    },
    renderTrainerMainBottomBar(activeTab, additionalProps = {}) {
      return renderTrainerMainBottomBarInternal({
        activeTab,
        isTrainerMode,
        onGoMain,
        onOpenTraining,
        onOpenNutrition,
        onOpenCabinet,
        onOpenTrainerClients,
        onOpenTrainerPrograms,
        onLoadTrainerCabinet,
        ...additionalProps
      });
    },
    renderTrainerWorkspaceBottomBar(activeTab, additionalProps = {}) {
      return renderTrainerWorkspaceBottomBarInternal({
        activeTab,
        onGoMain,
        onOpenTrainerClients,
        onOpenTrainerPrograms,
        onLoadTrainerCabinet,
        ...additionalProps
      });
    }
  };
}
