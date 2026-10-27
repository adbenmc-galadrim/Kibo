import type { CiRun, FileRef, ProjectSnapshot, TicketView } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import {
  Bot,
  CalendarRange,
  CircleDot,
  CircleX,
  Flag,
  GitBranch,
  GitPullRequest,
  History,
  type LucideIcon,
  MessageCircleQuestion,
  Pause,
} from "lucide-react";
import { frTicketTracking as t } from "../../i18n/fr-ticket-tracking";
import { ActivityTab } from "../../shell/lazy-screens";
import { useAgentsState } from "../../state/agents-context";
import { useNow } from "../../state/use-agents";
import { FoldSection } from "../FoldSection";
import type { TicketJournal } from "../use-ticket-tracking";
import { type TimelineKind, type TimelineLine, ticketTimeline } from "./ticket-timeline";
import { ticketRuns } from "./timeline";

type Props = {
  project: ProjectSnapshot;
  ticket: TicketView;
  journal: TicketJournal;
  ciRuns: readonly CiRun[];
  onOpenFile(ref: FileRef): void;
};

const ICONS: Record<TimelineKind, { icon: LucideIcon; tone: string }> = {
  branch: { icon: GitBranch, tone: "text-(--tracking-blue)" },
  pr: { icon: GitPullRequest, tone: "text-(--tracking-purple)" },
  review: { icon: GitPullRequest, tone: "text-(--tracking-amber)" },
  checks: { icon: CircleX, tone: "text-(--tracking-red)" },
  step: { icon: Flag, tone: "text-(--tracking-mfg)" },
  session: { icon: Bot, tone: "text-(--tracking-brand)" },
  status: { icon: CircleDot, tone: "text-(--tracking-mfg)" },
  sprint: { icon: CalendarRange, tone: "text-(--tracking-mfg)" },
  question: { icon: MessageCircleQuestion, tone: "text-(--tracking-mfg)" },
  hold: { icon: Pause, tone: "text-(--tracking-mfg)" },
  other: { icon: History, tone: "text-(--tracking-mfg)" },
};
const CHECK_TONES = { ok: "text-(--tracking-green)", running: "text-(--tracking-amber)", error: "" } as const;

function Entry({ line, last }: { line: TimelineLine; last: boolean }) {
  const { icon: Icon, tone } = ICONS[line.kind];
  return (
    <li data-journal={line.kind} className="flex gap-3">
      <span className="flex w-6 shrink-0 flex-col items-center">
        <span className="grid size-6 place-items-center rounded-full bg-(--tracking-muted)">
          <Icon aria-hidden className={cn("size-3", tone, line.tone && CHECK_TONES[line.tone])} />
        </span>
        {!last && <span aria-hidden className="w-px flex-1 bg-border" />}
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5 pt-0.5 pb-3.5">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "min-w-0 flex-1 wrap-anywhere text-[13px] font-medium",
              line.kind === "session" && "text-(--tracking-brand-text)",
            )}
          >
            {line.text}
          </span>
          <time className="shrink-0 text-xs text-muted-foreground">{line.time}</time>
        </span>
        {line.aside && (
          <span className="text-xs text-muted-foreground">
            {line.aside.text}
            {line.aside.link && (
              <a
                href={line.aside.link.url}
                target="_blank"
                rel="noreferrer noopener"
                className="underline-offset-2 hover:underline"
              >
                {line.aside.link.label}
              </a>
            )}
          </span>
        )}
      </span>
    </li>
  );
}

export function TicketTimeline({ project, ticket, journal, ciRuns, onOpenFile }: Props) {
  const now = useNow(60_000);
  const agents = useAgentsState();
  const runs = ticketRuns(agents?.runs ?? [], ticket.id);
  const lines = ticketTimeline(journal.events, project, now, ciRuns);
  return (
    <div className="grid gap-4 pb-6 text-xs">
      <section aria-labelledby={`journal-${ticket.id}`} className="grid gap-2.5">
        <p className="flex items-baseline gap-2">
          <span id={`journal-${ticket.id}`} className="text-[13px] font-semibold">
            {t.journal}
          </span>
          <span className="text-[12.5px] text-muted-foreground">{t.journalHint}</span>
        </p>
        {journal.error && (
          <p role="alert" className="text-destructive">
            {t.journalError}
          </p>
        )}
        {!journal.error && lines.length === 0 && <p className="text-muted-foreground">{t.noJournal}</p>}
        <ol className="grid">
          {lines.map((line, i) => (
            <Entry key={line.id} line={line} last={i === lines.length - 1} />
          ))}
        </ol>
      </section>
      {runs.length > 0 && (
        <FoldSection title={t.oldRuns} hint={t.oldRunsHint}>
          <div className="-mx-4">
            <ActivityTab project={project} ticket={ticket} onOpenFile={onOpenFile} />
          </div>
        </FoldSection>
      )}
    </div>
  );
}
