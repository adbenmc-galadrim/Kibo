import { useSdk } from "@kibo/sdk";
import { useProject } from "@kibo/sdk/hooks/use-project";
import { useMemo, useState } from "react";
import { foldLanes } from "./fit-width";
import { fr } from "./fr";
import { type GraphViewKind, readView, writeView } from "./graph-view-pref";
import { PrsView } from "./lazy-panels";
import { SprintLanes } from "./SprintLanes";
import { Toolbar } from "./Toolbar";
import { useElementSize } from "./use-element-size";
import { useSprintLanes } from "./use-sprint-lanes";

function toggled(ids: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(ids);
  if (!next.delete(id)) next.add(id);
  return next;
}

export function GraphView() {
  const sdk = useSdk();
  const [view, setView] = useState<GraphViewKind>(() => readView(sdk.instanceId));
  const [prsCounter, setPrsCounter] = useState<string | null>(null);
  const [unfolded, setUnfolded] = useState<ReadonlySet<string> | null>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const { width } = useElementSize(body);
  const lanes = useSprintLanes();
  const project = useProject();
  const shown = useMemo(
    () => (unfolded === null ? lanes : foldLanes(lanes, unfolded, width)),
    [lanes, unfolded, width],
  );
  const onView = (next: GraphViewKind) => {
    writeView(sdk.instanceId, next);
    setView(next);
  };
  const onNewFeature = () => sdk.openView("planning", { intent: { kind: "newFeature" } });
  const onToggle = (id: string) => setUnfolded((current) => toggled(current ?? new Set(), id));
  return (
    <div className="flex h-full flex-col">
      <Toolbar
        view={view}
        onView={onView}
        counter={
          view === "prs"
            ? prsCounter
            : fr.sprints.counter(lanes.features, lanes.stepLinks, lanes.featureLinks)
        }
        fold={
          view === "prs"
            ? undefined
            : {
                active: unfolded !== null,
                onToggle: () => setUnfolded((current) => (current === null ? new Set() : null)),
              }
        }
      />
      <div ref={setBody} className="min-h-0 flex-1">
        {view === "prs" ? (
          <PrsView onCounter={setPrsCounter} />
        ) : (
          <SprintLanes
            model={shown}
            onOpen={(id) => sdk.openTicket(id)}
            onNewFeature={onNewFeature}
            onToggle={unfolded === null ? undefined : onToggle}
            project={project}
          />
        )}
      </div>
    </div>
  );
}
