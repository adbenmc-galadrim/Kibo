import { GitPullRequest } from "lucide-react";
import { frToday as t } from "./fr-today";
import { ProjectKey, SectionLine, SectionList } from "./SectionList";
import type { TodayPr } from "./today-model";

type Props = {
  rows: readonly TodayPr[];
  onOpenTicket(projectId: string, ticketId: string): void;
};

const stateClass = (state: TodayPr["state"]): string =>
  state === "changes" ? "font-medium text-(--tracking-amber)" : "text-(--tracking-mfg)";

export function PrsSection({ rows, onOpenTicket }: Props) {
  return (
    <SectionList icon={GitPullRequest} title={t.prs.title} count={rows.length}>
      {rows.map((row) => (
        <SectionLine
          key={`${row.projectId}/${row.pr.number}`}
          dot="purple"
          label={`#${row.pr.number}`}
          labelWidth={40}
          title={row.ticket.title}
          onOpen={() => onOpenTicket(row.projectId, row.ticket.id)}
        >
          <span className={`shrink-0 text-xs ${stateClass(row.state)}`}>{t.prs.state[row.state]}</span>
          <span className="shrink-0 font-mono text-xs text-(--tracking-mfg)">{row.ticket.keyLabel}</span>
          <ProjectKey value={row.projectKey} />
        </SectionLine>
      ))}
    </SectionList>
  );
}
