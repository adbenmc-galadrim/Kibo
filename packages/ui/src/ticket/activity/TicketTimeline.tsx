import type { FileRef, ProjectSnapshot, TicketView } from "@kibo/schema";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@kibo/sdk/ui/collapsible";
import {
  CalendarRange,
  ChevronRight,
  CircleDot,
  Flag,
  GitBranch,
  GitPullRequest,
  History,
  type LucideIcon,
  MessageCircleQuestion,
  Radio,
} from "lucide-react";
import type { ReactNode } from "react";
import { frTicketTracking as t } from "../../i18n/fr-ticket-tracking";
import { ActivityTab } from "../../shell/lazy-screens";
import { useAgentsState } from "../../state/agents-context";
import { useNow } from "../../state/use-agents";
import { useTicketJournal } from "../use-ticket-tracking";
import { type TimelineKind, ticketTimeline } from "./ticket-timeline";
import { ticketRuns } from "./timeline";

type Props = { project: ProjectSnapshot; ticket: TicketView; onOpenFile(ref: FileRef): void };

const ICONS: Record<TimelineKind, { icon: LucideIcon; tone: string }> = {
  branch: { icon: GitBranch, tone: "text-(--tracking-blue)" },
  pr: { icon: GitPullRequest, tone: "text-(--tracking-purple)" },
  review: { icon: GitPullRequest, tone: "text-(--tracking-purple)" },
  step: { icon: Flag, tone: "text-(--tracking-mfg)" },
  session: { icon: Radio, tone: "text-(--tracking-mfg)" },
  status: { icon: CircleDot, tone: "text-(--tracking-mfg)" },
  sprint: { icon: CalendarRange, tone: "text-(--tracking-mfg)" },
  question: { icon: MessageCircleQuestion, tone: "text-(--tracking-mfg)" },
  other: { icon: History, tone: "text-(--tracking-mfg)" },
};

function OldRuns({ count, children }: { count: number; children: ReactNode }) {
  return (
    <Collapsible className="grid gap-3">
      <CollapsibleTrigger className="group flex w-fit items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ChevronRight
          aria-hidden
          className="size-3.5 transition-transform group-data-[state=open]:rotate-90"
        />
        {t.oldRuns(count)}
      </CollapsibleTrigger>
      <CollapsibleContent className="-mx-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function TicketTimeline({ project, ticket, onOpenFile }: Props) {
  const journal = useTicketJournal(project, ticket.id);
  const now = useNow(60_000);
  const agents = useAgentsState();
  const runs = ticketRuns(agents?.runs ?? [], ticket.id);
  const lines = ticketTimeline(journal.events, project, now);
  return (
    <div className="grid gap-4 px-4 pb-6 text-xs">
      <section aria-label={t.journal} className="grid gap-1">
        {journal.error && (
          <p role="alert" className="text-destructive">
            {t.journalError}
          </p>
        )}
        {!journal.error && lines.length === 0 && <p className="text-muted-foreground">{t.noJournal}</p>}
        <ol className="grid">
          {lines.map((line) => {
            const { icon: Icon, tone } = ICONS[line.kind];
            return (
              <li
                key={line.id}
                data-journal={line.kind}
                className="flex items-center gap-2 border-b border-border/60 py-2 last:border-b-0"
              >
                <Icon aria-hidden className={`size-3.5 shrink-0 ${tone}`} />
                <span className="min-w-0 flex-1 truncate">{line.text}</span>
                <time className="shrink-0 font-mono text-2xs text-muted-foreground">{line.time}</time>
              </li>
            );
          })}
        </ol>
      </section>
      {runs.length > 0 && (
        <OldRuns count={runs.length}>
          <ActivityTab project={project} ticket={ticket} onOpenFile={onOpenFile} />
        </OldRuns>
      )}
    </div>
  );
}
