import type { ProjectCommand, SprintView } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { CalendarRange, ExternalLink, Pencil } from "lucide-react";
import { type ReactNode, useState } from "react";
import { frFeature } from "../../i18n/fr-group";
import { frSprint } from "../../i18n/fr-sprint";
import { dateRange } from "../feature/time-format";
import { SprintEditDialog } from "./SprintEditDialog";
import { SprintFeatureRow } from "./SprintFeatureRow";
import type { SprintFeature, SprintTiming } from "./sprint-facts";

type Props = {
  sprint: SprintView;
  features: SprintFeature[];
  timing: SprintTiming;
  editable: boolean;
  banner: ReactNode;
  title(props: { className: string; children: ReactNode }): ReactNode;
  command(command: ProjectCommand): Promise<unknown>;
  onOpenTicket(ticketId: string): void;
  onOpenInTab?: () => void;
};

const STATE = {
  current: "bg-(--tracking-blue-soft) text-(--tracking-blue)",
  done: "bg-(--tracking-muted) text-(--tracking-mfg)",
  planned: "bg-(--tracking-muted) text-(--tracking-mfg)",
} as const;
const ACTION =
  "h-[25px] gap-[6px] rounded-[6px] px-[10px] text-[12px] leading-[15px] font-medium shadow-none has-[>svg]:px-[10px] [&_svg:not([class*='size-'])]:size-[13px]";

const dayMonth = (day: string): string => {
  const [, month = 1, date = 1] = day.split("-").map(Number);
  return `${date} ${frFeature.month(month - 1)}`;
};

function timingText(timing: SprintTiming): string {
  switch (timing.kind) {
    case "endsToday":
      return frSprint.endsToday;
    case "endsIn":
      return frSprint.endsIn(timing.days);
    case "ended":
      return frSprint.ended(dayMonth(timing.end));
    case "starts":
      return frSprint.starts(dayMonth(timing.start));
  }
}

export function SprintDetail({ sprint, features, timing, editable, banner, title: Title, ...p }: Props) {
  const [editing, setEditing] = useState(false);
  const delivered = features.filter((f) => f.status === "delivered").length;
  return (
    <div className="flex flex-col gap-[14px] p-[19px]">
      <header className="flex flex-col gap-[8px] pr-8">
        <div className="flex items-center gap-[8px]">
          <CalendarRange
            absoluteStrokeWidth
            size={16}
            aria-hidden
            className="size-[16px] text-(--tracking-mfg)"
          />
          <Title className="min-w-0 truncate text-[16px] leading-[20px] font-semibold text-(--tracking-fg)">
            {frSprint.title(sprint.code, sprint.name)}
          </Title>
          <span
            className={`rounded-[4px] px-[6px] py-[1px] text-[11px] leading-[14px] ${STATE[sprint.state]}`}
          >
            {frSprint.state[sprint.state]}
          </span>
          <span className="flex-1" />
          {editable && (
            <Button variant="outline" className={ACTION} onClick={() => setEditing(true)}>
              <Pencil absoluteStrokeWidth size={13} />
              {frSprint.edit}
            </Button>
          )}
          {p.onOpenInTab && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={frSprint.openInTab}
              title={frSprint.openInTab}
              onClick={p.onOpenInTab}
            >
              <ExternalLink absoluteStrokeWidth size={13} />
            </Button>
          )}
        </div>
        <p className="flex items-center gap-[6px] text-[12.5px] leading-[15px]">
          <CalendarRange
            absoluteStrokeWidth
            size={13}
            aria-hidden
            className="size-[13px] text-(--tracking-dim)"
          />
          <span className="text-(--tracking-fg)">{dateRange(sprint.start, sprint.end)}</span>
          <span className="text-(--tracking-dim)">{`· ${timingText(timing)} · ${frSprint.delivered(delivered, features.length)}`}</span>
        </p>
      </header>
      {features.length === 0 ? (
        <p className="text-[12.5px] text-(--tracking-dim)">{frSprint.empty}</p>
      ) : (
        <ul
          aria-label={frSprint.features}
          className="overflow-hidden rounded-[8px] border border-(--tracking-border) bg-(--tracking-card)"
        >
          {features.map((f) => (
            <SprintFeatureRow key={f.id} feature={f} onOpen={p.onOpenTicket} />
          ))}
        </ul>
      )}
      {banner}
      <p className="text-[12px] leading-[16px] text-(--tracking-dim)">{frSprint.footer}</p>
      {editing && (
        <SprintEditDialog
          sprint={sprint}
          features={features.length}
          command={p.command}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
