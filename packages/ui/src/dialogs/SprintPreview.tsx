import { type ProjectSetup, sprintPlan } from "@kibo/schema";
import { CalendarRange, ChevronDown, ChevronUp } from "lucide-react";
import { useId, useState } from "react";
import { frNewProject as t } from "../i18n/fr-new-project";
import { dateRange } from "../shell/feature/time-format";

const SHOWN_SPRINTS = 8;

type Props = { setup: ProjectSetup; summary: string };

export function SprintPreview({ setup, summary }: Props) {
  const [open, setOpen] = useState(true);
  const listId = useId();
  const sprints = sprintPlan(setup);
  const hidden = sprints.length - SHOWN_SPRINTS;
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <section className="grid w-full gap-[10px] rounded-[8px] bg-muted px-[14px] py-[12px]">
      <div className="flex items-center gap-2">
        <CalendarRange aria-hidden className="size-[14px] shrink-0" />
        <p aria-live="polite" className="min-w-0 flex-1 text-[13px] leading-4 font-medium">
          {summary}
        </p>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={open ? t.hideSprints : t.showSprints}
          onClick={() => setOpen(!open)}
          className="k-focus rounded-sm text-muted-foreground hover:text-foreground"
        >
          <Chevron aria-hidden className="size-[14px]" />
        </button>
      </div>
      {open && (
        <div id={listId} className="grid gap-2">
          <ul className="grid grid-cols-3 gap-x-2 gap-y-2">
            {sprints.slice(0, SHOWN_SPRINTS).map((s) => (
              <li
                key={s.code}
                className="flex items-center gap-2 text-[12px] leading-[15px] text-muted-foreground"
              >
                <span className="font-mono">{s.code}</span>
                <span>{dateRange(s.start, s.end)}</span>
              </li>
            ))}
          </ul>
          {hidden > 0 && <p className="text-[12px] leading-[15px] text-muted-foreground">{t.more(hidden)}</p>}
        </div>
      )}
    </section>
  );
}
