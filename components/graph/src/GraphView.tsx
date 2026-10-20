import { useSdk } from "@kibo/sdk";
import { useState } from "react";
import { fr } from "./fr";
import { type GraphViewKind, readView, writeView } from "./graph-view-pref";
import { PrsView } from "./lazy-panels";
import { SprintLanes } from "./SprintLanes";
import { Toolbar } from "./Toolbar";
import { useSprintLanes } from "./use-sprint-lanes";

export function GraphView() {
  const sdk = useSdk();
  const [view, setView] = useState<GraphViewKind>(() => readView(sdk.instanceId));
  const lanes = useSprintLanes();
  const onView = (next: GraphViewKind) => {
    writeView(sdk.instanceId, next);
    setView(next);
  };
  const onNewFeature = () => sdk.openView("planning", { intent: { kind: "newFeature" } });
  return (
    <div className="flex h-full flex-col">
      <Toolbar
        view={view}
        onView={onView}
        counter={
          view === "prs" ? null : fr.sprints.counter(lanes.features, lanes.stepLinks, lanes.featureLinks)
        }
      />
      <div className="min-h-0 flex-1">
        {view === "prs" ? (
          <PrsView />
        ) : (
          <SprintLanes model={lanes} onOpen={(id) => sdk.openTicket(id)} onNewFeature={onNewFeature} />
        )}
      </div>
    </div>
  );
}
