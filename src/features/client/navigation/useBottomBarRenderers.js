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
      const normalizedProps =
        activeTab && typeof activeTab === "object"
          ? activeTab
          : { activeTab, ...additionalProps };

      return renderClientMainBottomBarInternal({
        isTrainerMode,
        onGoMain,
        onOpenTraining,
        onOpenNutrition,
        onOpenCabinet,
        onOpenTrainerClients,
        onOpenTrainerPrograms,
        onLoadTrainerCabinet,
        ...normalizedProps
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
