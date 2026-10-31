import { cn } from "@kibo/sdk/lib/utils";
import { CalendarRange, Inbox } from "lucide-react";
import { CollapsedFrame } from "./CollapsedFrame";
import { EmptyGraph } from "./EmptyGraph";
import { FeatureFrame } from "./FeatureFrame";
import type { LaunchProject } from "./FrameStepRow";
import { fr } from "./fr";
import { LANE_MARGIN } from "./frame-geometry";
import { GraphLegend } from "./GraphLegend";
import type { Lane, SprintLanesModel } from "./sprint-lanes";
import { SPRINT_LEGEND } from "./sprint-legend-items";

const laneBackground = (lane: Lane): string =>
  lane.tone === "panel" ? "bg-(--tracking-panel)" : "bg-(--tracking-canvas)";

function LaneHeader({ lane }: { lane: Lane }) {
  const current = lane.state === "current";
  const strong = current ? "text-(--tracking-fg)" : "text-(--tracking-mfg)";
  const soft = current ? "text-(--tracking-fg)" : "text-(--tracking-dim)";
  const Icon = lane.code === null ? Inbox : CalendarRange;
  return (
    <div
      data-slot="lane-header"
      className={cn(
        "sticky top-0 z-10 flex h-[51px] flex-col gap-0.5 border-(--tracking-border) border-b pt-3",
        laneBackground(lane),
      )}
      style={{ paddingLeft: LANE_MARGIN, paddingRight: LANE_MARGIN }}
    >
      <div className="flex h-[15px] items-center gap-1.5 font-semibold text-xs leading-[15px]">
        <Icon size={12} absoluteStrokeWidth aria-hidden className={cn("shrink-0", soft)} />
        {lane.code === null ? (
          <span className={strong}>{fr.sprints.reserve}</span>
        ) : (
          <>
            <span className={cn("font-mono", strong)}>{lane.code}</span>
            <span title={lane.name ?? undefined} className={cn("truncate", strong)}>
              {lane.name}
            </span>
          </>
        )}
      </div>
      {lane.label !== null && (
        <span title={lane.label} className={cn("truncate text-[11px] leading-[14px]", soft)}>
          {lane.label}
        </span>
      )}
    </div>
  );
}

const laneLabel = (lane: Lane): string =>
  lane.code === null ? fr.sprints.reserve : `${lane.code} ${lane.name ?? ""}`.trim();

type Props = {
  model: SprintLanesModel;
  onOpen(id: string): void;
  project?: LaunchProject | null;
  onNewFeature(): void;
  onToggle?(id: string): void;
};

export function SprintLanes({ model, onOpen, onNewFeature, onToggle, project }: Props) {
  return (
    <div className="relative h-full min-h-0 bg-(--tracking-canvas)">
      <section aria-label={fr.sprints.canvas} className="h-full overflow-auto">
        <div className="relative min-h-full min-w-full" style={{ width: model.width, height: model.height }}>
          {model.lanes.map((lane) => (
            <fieldset
              key={lane.id}
              aria-label={laneLabel(lane)}
              data-lane={lane.code ?? lane.id}
              data-state={lane.state ?? undefined}
              className={cn("absolute top-0 bottom-0 m-0 min-w-0 border-0 p-0", laneBackground(lane))}
              style={{ left: lane.x, width: lane.width }}
            >
              <LaneHeader lane={lane} />
            </fieldset>
          ))}
          <div
            aria-hidden
            className="pointer-events-none sticky top-0 h-[51px] border-(--tracking-border) border-b"
          />
          {model.lanes.flatMap((lane) =>
            lane.frames.map((frame) =>
              frame.folded && onToggle !== undefined ? (
                <CollapsedFrame key={frame.id} frame={frame} onToggle={onToggle} />
              ) : (
                <FeatureFrame
                  key={frame.id}
                  frame={frame}
                  onOpen={onOpen}
                  onToggle={onToggle}
                  project={project}
                />
              ),
            ),
          )}
          {model.features === 0 && (
            <EmptyGraph onNewFeature={onNewFeature} className="absolute inset-x-0 top-[51px] bottom-0" />
          )}
        </div>
      </section>
      <GraphLegend items={SPRINT_LEGEND} />
    </div>
  );
}
