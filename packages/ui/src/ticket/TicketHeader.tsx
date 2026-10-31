import type { ProjectSnapshot, TicketView } from "@kibo/schema";
import { CalendarRange, Package } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { headerContext } from "./tracking-model";

type Props = { project: Pick<ProjectSnapshot, "tickets" | "sprints">; ticket: TicketView };

const ICON = "size-3 shrink-0";

export function TicketHeader({ project, ticket }: Props) {
  const context = headerContext(ticket, project);
  const parts: { key: string; node: ReactNode }[] = [];
  if (context.feature)
    parts.push({
      key: "feature",
      node: (
        <span className="inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-px font-medium">
          <Package aria-hidden className={ICON} />
          {context.feature}
        </span>
      ),
    });
  if (context.sprint)
    parts.push({
      key: "sprint",
      node: (
        <span className="inline-flex items-center gap-1">
          <CalendarRange aria-hidden className={ICON} />
          {context.sprint}
        </span>
      ),
    });
  if (parts.length === 0) return null;
  return (
    <p
      data-ticket-context
      className="flex flex-wrap items-center gap-1.5 font-mono text-xs text-muted-foreground"
    >
      {parts.map((part, i) => (
        <Fragment key={part.key}>
          {i > 0 && <span className="font-sans text-(--tracking-faint)">{" · "}</span>}
          {part.node}
        </Fragment>
      ))}
    </p>
  );
}
