import { fr, type Lane, type LaneStep } from "@kibo/component-graph/models";
import { useLayoutEffect, useRef } from "react";
import { COLUMN_WIDTH, startLane } from "./graph-columns";
import { PhoneFeatureFrame } from "./PhoneFeatureFrame";

const SAFE_SIDES =
  "pr-[calc(16px+env(safe-area-inset-right))] pl-[calc(16px+env(safe-area-inset-left))] scroll-pl-[calc(16px+env(safe-area-inset-left))]";

type FrameActions = {
  unfolded: ReadonlySet<string> | null;
  onToggle(id: string): void;
  onOpen(id: string): void;
  onMenu(step: LaneStep): void;
};

const laneLabel = (lane: Lane): string =>
  lane.code === null ? fr.sprints.reserve : `${lane.code} ${lane.name ?? ""}`.trim();

function ColumnHeader({ lane }: { lane: Lane }) {
  return (
    <div className="flex flex-col gap-0.5 pt-3.5 pb-3">
      <p className="flex min-w-0 items-baseline gap-1.5">
        {lane.code === null ? (
          <span className="font-semibold text-[15px]">{fr.sprints.reserve}</span>
        ) : (
          <>
            <span className="shrink-0 font-mono font-semibold text-[12.5px]">{lane.code}</span>
            <span className="truncate font-semibold text-[15px]">{lane.name}</span>
          </>
        )}
      </p>
      {lane.label !== null && <p className="truncate text-(--tracking-mfg) text-[12.5px]">{lane.label}</p>}
    </div>
  );
}

function SprintColumn({ lane, ...actions }: { lane: Lane } & FrameActions) {
  const { unfolded } = actions;
  return (
    <fieldset
      aria-label={laneLabel(lane)}
      data-lane={lane.code ?? lane.id}
      data-lane-id={lane.id}
      data-state={lane.state ?? undefined}
      className="m-0 h-full min-w-0 shrink-0 snap-start border-0 p-0"
      style={{ width: COLUMN_WIDTH }}
    >
      <div data-slot="column-scroll" className="h-full overflow-y-auto overscroll-contain pb-6">
        <ColumnHeader lane={lane} />
        <div className="flex flex-col gap-3">
          {lane.frames.map((frame) => (
            <PhoneFeatureFrame
              key={frame.id}
              frame={frame}
              folded={unfolded !== null && !unfolded.has(frame.id)}
              onToggle={unfolded === null ? undefined : actions.onToggle}
              onOpen={actions.onOpen}
              onMenu={actions.onMenu}
            />
          ))}
        </div>
      </div>
    </fieldset>
  );
}

export function SprintColumns({ lanes, ...actions }: { lanes: readonly Lane[] } & FrameActions) {
  const scroller = useRef<HTMLElement | null>(null);
  const start = startLane(lanes);
  useLayoutEffect(() => {
    if (start === null) return;
    const columns = Array.from(scroller.current?.children ?? []);
    const column = columns.find((c) => c.getAttribute("data-lane-id") === start);
    column?.scrollIntoView({ inline: "start", block: "nearest" });
  }, [start]);
  return (
    <section
      ref={scroller}
      aria-label={fr.sprints.canvas}
      className={`flex h-full snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden overscroll-x-contain ${SAFE_SIDES}`}
    >
      {lanes.map((lane) => (
        <SprintColumn key={lane.id} lane={lane} {...actions} />
      ))}
    </section>
  );
}
