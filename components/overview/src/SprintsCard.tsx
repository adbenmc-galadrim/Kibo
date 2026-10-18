import type { SprintView } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { CalendarRange } from "lucide-react";
import { fr } from "./fr";
import { sprintDates } from "./overview-facts";
import { CARD, CardHeader, ROW_LINE } from "./parts";

type Props = { sprints: readonly SprintView[]; current: string | null; onOpenSprint(id: string): void };

export function SprintsCard({ sprints, current, onOpenSprint }: Props) {
  return (
    <section aria-label={fr.sprints.title} className={CARD}>
      <CardHeader icon={CalendarRange} title={fr.sprints.title} count={sprints.length} />
      {sprints.length === 0 ? (
        <p className={cn("px-[16px] py-[12px] text-(--tracking-mfg) text-[12.5px]", ROW_LINE)}>
          {fr.sprint.none}
        </p>
      ) : (
        <ul>
          {sprints.map((s) => (
            <li key={s.id} className={cn("flex h-[38px] items-center gap-[10px] px-[16px]", ROW_LINE)}>
              <span
                className={cn(
                  "w-[26px] shrink-0 font-mono text-[12px] leading-[15px]",
                  s.id === current ? "font-semibold text-(--tracking-fg)" : "text-(--tracking-mfg)",
                )}
              >
                {s.code}
              </span>
              <button
                type="button"
                className="min-w-0 flex-1 cursor-pointer truncate text-left text-(--tracking-fg) text-[13px] leading-[16px] hover:underline"
                onClick={() => onOpenSprint(s.id)}
              >
                {s.name}
              </button>
              <span className="shrink-0 text-(--tracking-mfg) text-[12.5px] leading-[15px]">
                {sprintDates(s.start, s.end)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
