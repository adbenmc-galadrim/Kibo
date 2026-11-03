import { fr, type LaneStep, readView, useSprintLanes, writeView } from "@kibo/component-graph/models";
import { type KiboClient, SdkProvider, useSdk } from "@kibo/sdk";
import { Expand, Info, Shrink } from "lucide-react";
import { useState } from "react";
import { fr as frPhone } from "../../i18n/fr";
import { frGraph } from "../../i18n/fr-graph";
import { visibleLanes } from "./graph-columns";
import { LegendSheet } from "./LegendSheet";
import { PhonePrsView } from "./PhonePrsView";
import { SprintColumns } from "./SprintColumn";
import { StepMenu } from "./StepMenu";
import { useGraphSdk } from "./use-graph-sdk";
import { ViewSwitch } from "./ViewSwitch";

const SQUARE =
  "flex size-11 shrink-0 items-center justify-center rounded-lg border border-(--tracking-border) text-(--tracking-fg)";

const toggled = (ids: ReadonlySet<string>, id: string): ReadonlySet<string> => {
  const next = new Set(ids);
  if (!next.delete(id)) next.add(id);
  return next;
};

function EmptyGraph() {
  const sdk = useSdk();
  return (
    <div className="flex flex-col items-center gap-3 px-6 pt-20 text-center">
      <p className="text-(--tracking-mfg) text-[15px]">{frGraph.empty}</p>
      <button
        type="button"
        onClick={() => sdk.openView("planning", { intent: { kind: "newFeature" } })}
        className="flex h-11 items-center rounded-lg border border-(--tracking-border) px-4 font-medium text-[15px]"
      >
        {frGraph.newFeature}
      </button>
    </div>
  );
}

export function PhoneGraph({ writable }: { writable: boolean }) {
  const sdk = useSdk();
  const model = useSprintLanes();
  const [view, setView] = useState(() => readView(sdk.instanceId));
  const [unfolded, setUnfolded] = useState<ReadonlySet<string> | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [legend, setLegend] = useState(false);
  const [menu, setMenu] = useState<LaneStep | null>(null);
  const features = view === "features";
  const FoldIcon = unfolded === null ? Shrink : Expand;
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-(--tracking-canvas)">
      <div className="flex h-14 shrink-0 items-center gap-2 border-(--tracking-border) border-b bg-(--tracking-bg) px-4">
        <ViewSwitch
          view={view}
          onView={(next) => {
            writeView(sdk.instanceId, next);
            setView(next);
          }}
        />
        <span className="flex-1" />
        {features && (
          <button
            type="button"
            aria-pressed={unfolded !== null}
            aria-label={unfolded === null ? frGraph.foldAll : frGraph.unfoldAll}
            onClick={() => setUnfolded((current) => (current === null ? new Set() : null))}
            className={SQUARE}
          >
            <FoldIcon aria-hidden size={16} absoluteStrokeWidth />
          </button>
        )}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={features ? frGraph.legend : frGraph.legendPrs}
          onClick={() => setLegend(true)}
          className={SQUARE}
        >
          <Info aria-hidden size={16} absoluteStrokeWidth />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {!features ? (
          <div className="h-full overflow-y-auto overscroll-contain">
            <PhonePrsView />
          </div>
        ) : model.features === 0 ? (
          <EmptyGraph />
        ) : (
          <SprintColumns
            lanes={visibleLanes(model.lanes, filter)}
            unfolded={unfolded}
            onToggle={(id) => setUnfolded((current) => toggled(current ?? new Set(), id))}
            onOpen={(id) => sdk.openTicket(id)}
            onMenu={setMenu}
          />
        )}
      </div>
      {legend && (
        <LegendSheet
          view={view}
          lanes={model.lanes}
          filter={filter}
          counter={fr.sprints.counter(model.features, model.stepLinks, model.featureLinks)}
          onFilter={setFilter}
          onClose={() => setLegend(false)}
        />
      )}
      {menu !== null && <StepMenu step={menu} writable={writable} onClose={() => setMenu(null)} />}
    </div>
  );
}

type ScreenProps = { projectId: string; client: KiboClient; writable: boolean };

export function GraphScreen({ projectId, client, writable }: ScreenProps) {
  const sdk = useGraphSdk(projectId, client);
  if (sdk === null) return <p className="p-4 text-(--tracking-mfg) text-[15px]">{frPhone.loading}</p>;
  return (
    <SdkProvider sdk={sdk}>
      <PhoneGraph writable={writable} />
    </SdkProvider>
  );
}
