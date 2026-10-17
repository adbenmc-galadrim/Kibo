import { SprintTimeline } from "@kibo/sdk/tracking";
import type { BandsTimeline } from "./bands-model";
import { fr } from "./fr";

type Props = { timeline: BandsTimeline; onOpen(id: string): void };

export function PlanningBands({ timeline, onOpen }: Props) {
  const { columns, rows, today, delivered } = timeline;
  return (
    <div className="flex min-h-0 w-fit max-w-full flex-col self-start overflow-y-auto rounded-[10px] border border-(--tracking-border) bg-(--tracking-card)">
      <SprintTimeline
        columns={columns}
        rows={rows}
        today={today}
        collapsed={{ label: fr.bands.delivered(delivered.length), rows: delivered }}
        legend
        onOpen={onOpen}
      />
    </div>
  );
}
