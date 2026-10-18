import { cn } from "@kibo/sdk/lib/utils";
import { CalendarRange, Inbox } from "lucide-react";
import { EmptyGraph } from "./EmptyGraph";
import { FeatureFrame } from "./FeatureFrame";
import { fr } from "./fr";
import { LANE_MARGIN } from "./frame-geometry";
import { LaneEdges } from "./LaneEdges";
import { SprintLegend } from "./SprintLegend";
import type { Lane, SprintLanesModel } from "./sprint-lanes";

const HEADER_TOP = 12;

function LaneHeader({ lane }: { lane: Lane }) {
  const current = lane.state === "current";
  const strong = current ? "text-(--tracking-fg)" : "text-(--tracking-mfg)";
  const soft = current ? "text-(--tracking-fg)" : "text-(--tracking-dim)";
  const Icon = lane.code === null ? Inbox : CalendarRange;
  return (
    <div
      className="absolute flex flex-col gap-0.5"
      style={{ left: LANE_MARGIN, top: HEADER_TOP, right: LANE_MARGIN }}
    >
      <div className="flex h-[15px] items-center gap-1.5 font-semibold text-xs leading-[15px]">
        <Icon size={12} absoluteStrokeWidth aria-hidden className={cn("shrink-0", soft)} />
        {lane.code === null ? (
          <span className={strong}>{fr.sprints.reserve}</span>
        ) : (
          <>
            <span className={cn("font-mono", strong)}>{lane.code}</span>
            <span className={cn("truncate", strong)}>{lane.name}</span>
          </>
        )}
      </div>
      {lane.label !== null && <span className={cn("text-[11px] leading-[14px]", soft)}>{lane.label}</span>}
    </div>
  );
}

const laneLabel = (lane: Lane): string =>
  lane.code === null ? fr.sprints.reserve : `${lane.code} ${lane.name ?? ""}`.trim();

type Props = { model: SprintLanesModel; onOpen(id: string): void; onNewFeature(): void };

export function SprintLanes({ model, onOpen, onNewFeature }: Props) {
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
              className={cn(
                "absolute top-0 bottom-0 m-0 min-w-0 border-0 p-0",
                lane.tone === "panel" ? "bg-(--tracking-panel)" : "bg-(--tracking-canvas)",
              )}
              style={{ left: lane.x, width: lane.width }}
            >
              <LaneHeader lane={lane} />
            </fieldset>
          ))}
          <div aria-hidden className="absolute inset-x-0 top-[50px] h-px bg-(--tracking-border)" />
          <LaneEdges model={model} />
          {model.lanes.flatMap((lane) =>
            lane.frames.map((frame) => <FeatureFrame key={frame.id} frame={frame} onOpen={onOpen} />),
          )}
          {model.features === 0 && (
            <EmptyGraph onNewFeature={onNewFeature} className="absolute inset-x-0 top-[51px] bottom-0" />
          )}
        </div>
      </section>
      <SprintLegend />
    </div>
  );
}
