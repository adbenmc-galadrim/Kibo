import { SprintTimeline } from "@kibo/sdk/tracking";
import { Calendar } from "lucide-react";
import { fr } from "./fr";
import type { Deadlines } from "./overview-model";
import { CARD, CardHeader, ROW_LINE } from "./parts";

type Props = { deadlines: Deadlines; onOpenTicket(id: string): void };

export function DeadlinesCard({ deadlines, onOpenTicket }: Props) {
  return (
    <section aria-label={fr.deadlines.title} className={CARD}>
      <CardHeader
        icon={Calendar}
        title={fr.deadlines.title}
        aside={
          <span className="text-(--tracking-mfg) text-[12.5px] leading-[15px]">
            {deadlines.later > 0
              ? `${fr.deadlines.subtitle} · ${fr.deadlines.later(deadlines.later)}`
              : fr.deadlines.subtitle}
          </span>
        }
      />
      <div className={ROW_LINE}>
        {deadlines.columns.length === 0 ? (
          <p className="px-[16px] py-[12px] text-(--tracking-mfg) text-[12.5px]">{fr.deadlines.empty}</p>
        ) : (
          <SprintTimeline {...deadlines} legend onOpen={onOpenTicket} />
        )}
      </div>
    </section>
  );
}
