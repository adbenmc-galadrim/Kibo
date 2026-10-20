import { useSdk } from "@kibo/sdk";
import { SprintLanes } from "./SprintLanes";
import { SprintToolbar } from "./SprintToolbar";
import { useSprintLanes } from "./use-sprint-lanes";

export function GraphView() {
  const sdk = useSdk();
  const lanes = useSprintLanes();
  const onNewFeature = () => sdk.openView("planning", { intent: { kind: "newFeature" } });
  return (
    <div className="flex h-full flex-col">
      <SprintToolbar model={lanes} />
      <div className="min-h-0 flex-1">
        <SprintLanes model={lanes} onOpen={(id) => sdk.openTicket(id)} onNewFeature={onNewFeature} />
      </div>
    </div>
  );
}
