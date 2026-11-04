import TrainerE2EHarness from "../../components/trainer/TrainerE2EHarness";
// DEV enters directly, bypassing the production role loader that owns this layer.
import "../../components/trainer/TrainerWorkspaceV2.module.css";
import TrainerProgramManagerView from "./TrainerProgramManagerView";

export default function TrainerFullE2EHarness() {
  return <TrainerE2EHarness ProgramManagerView={TrainerProgramManagerView} />;
}
