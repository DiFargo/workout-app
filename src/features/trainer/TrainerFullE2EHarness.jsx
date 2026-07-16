import TrainerE2EHarness from "../../components/trainer/TrainerE2EHarness";
import TrainerProgramManagerView from "./TrainerProgramManagerView";

export default function TrainerFullE2EHarness() {
  return <TrainerE2EHarness ProgramManagerView={TrainerProgramManagerView} />;
}
