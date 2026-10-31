import { Lock } from "lucide-react";
import { frToday as t } from "./fr-today";
import { ProjectKey, SectionLine, SectionList } from "./SectionList";
import type { TodayBlocked } from "./today-model";

const LIMIT = 5;

function reasonText({ reason }: TodayBlocked): string {
  if (reason.kind === "status") return reason.detail ?? t.blocking.status;
  return reason.detail === null
    ? t.blocking.question(reason.label, reason.feature)
    : t.blocking.detailed(reason.detail, reason.label);
}

type Props = {
  rows: readonly TodayBlocked[];
  questions: number;
  onOpenTicket(projectId: string, ticketId: string): void;
};

export function BlockingSection({ rows, questions, onOpenTicket }: Props) {
  return (
    <SectionList
      icon={Lock}
      title={t.blocking.title}
      count={rows.length}
      aside={t.blocking.aside(rows.length, questions)}
      limit={LIMIT}
    >
      {rows.map((row) => (
        <SectionLine
          key={`${row.projectId}/${row.ticket.id}`}
          dot="red"
          label={row.ticket.keyLabel}
          labelWidth={64}
          title={row.ticket.title}
          onOpen={() => onOpenTicket(row.projectId, row.ticket.id)}
        >
          <span className="shrink-0 text-xs text-(--tracking-mfg)">{reasonText(row)}</span>
          <ProjectKey value={row.projectKey} />
        </SectionLine>
      ))}
    </SectionList>
  );
}
