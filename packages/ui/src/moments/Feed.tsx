import type { AutoLink, FileRef, Overlap, RunMoment, RunSubagent, Step } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Badge } from "@kibo/sdk/ui/badge";
import { formatClock } from "../agents/format";
import type { frMoments } from "../i18n/fr-moments";
import { ActionsMoment } from "./ActionsMoment";
import { AutoLinkMoment } from "./AutoLinkMoment";
import { ExchangeLine, type FeedExtra } from "./ExchangeLine";
import { feedMoments } from "./feed-moments";
import type { FileContext } from "./file-context";
import { MessageMoment } from "./MessageMoment";
import { OverlapMoment } from "./OverlapMoment";
import { RawMoment } from "./RawMoment";
import { ReminderMoment } from "./ReminderMoment";
import { SignalMoment } from "./SignalMoment";
import { SubagentMoment } from "./SubagentMoment";

export type FeedProps = {
  moments: RunMoment[];
  showReasoning?: boolean;
  onOpenFile?(ref: FileRef): void;
  files?: FileContext | null;
  highlightStep?: string | null;
  steps?: Step[];
  label?: string;
  extras?: readonly FeedExtra[];
  texts: typeof frMoments;
  onOpenSignal?(signalId: string): void;
  overlaps?: ReadonlyMap<string, Overlap>;
  autoLinks?: ReadonlyMap<string, AutoLink>;
  canEdit?: boolean;
  onSeeFiles?(overlapId: string): void;
  onIgnoreOverlap?(overlapId: string): void;
  onCancelAutoLink?(autoLinkId: string): void;
  onOpenTicketKey?(key: string): void;
  now?: number;
  subagents?: ReadonlyMap<string, RunSubagent>;
  subagentId?: string;
};

const NO_SUBAGENTS: ReadonlyMap<string, RunSubagent> = new Map();

const ignore = () => {};

export type { FeedExtra };

type Entry = { at: number; moment: RunMoment } | { at: number; extra: FeedExtra };

function entriesOf(moments: readonly RunMoment[], extras: readonly FeedExtra[]): Entry[] {
  const all: Entry[] = [
    ...moments.map((moment) => ({ at: moment.at, moment })),
    ...extras.map((extra) => ({ at: extra.at, extra })),
  ];
  return all.sort((a, b) => a.at - b.at);
}

function MomentBody({
  moment,
  files,
  onOpenFile,
  onOpenSignal,
  texts,
  ...overlap
}: { moment: RunMoment } & Omit<FeedProps, "moments">) {
  const data = moment.data;
  switch (data.kind) {
    case "message":
      return <MessageMoment text={data.text} onTicket={overlap.onOpenTicketKey} />;
    case "reasoning":
      return (
        <div className="grid gap-1 border-l-2 pl-3 text-sm text-muted-foreground italic">
          <span className="text-xs not-italic">{texts.reasoning}</span>
          <MessageMoment text={data.text} />
        </div>
      );
    case "actions":
      return (
        <ActionsMoment
          actions={data.actions}
          summary={data.summary}
          failed={data.failed}
          files={files}
          onOpenFile={onOpenFile}
        />
      );
    case "reminder":
      return <ReminderMoment reminder={data.reminder} />;
    case "subagent": {
      const subagent = overlap.subagents?.get(data.subagentId);
      return subagent ? (
        <SubagentMoment
          subagent={subagent}
          subagents={overlap.subagents ?? NO_SUBAGENTS}
          now={overlap.now ?? Date.now()}
          files={files}
          onOpenFile={onOpenFile}
        />
      ) : null;
    }
    case "raw":
      return <RawMoment text={data.text} partial={data.partial} />;
    case "signal":
      return <SignalMoment data={data} at={moment.at} onOpen={onOpenSignal} />;
    case "overlap":
      return (
        <OverlapMoment
          data={data}
          at={moment.at}
          overlap={overlap.overlaps?.get(data.overlapId) ?? null}
          canEdit={overlap.canEdit ?? false}
          now={overlap.now}
          onSeeFiles={overlap.onSeeFiles ?? ignore}
          onIgnore={overlap.onIgnoreOverlap ?? ignore}
        />
      );
    case "auto_link":
      return (
        <AutoLinkMoment
          data={data}
          at={moment.at}
          link={data.autoLinkId === null ? null : (overlap.autoLinks?.get(data.autoLinkId) ?? null)}
          canEdit={overlap.canEdit ?? false}
          now={overlap.now}
          onCancel={overlap.onCancelAutoLink ?? ignore}
          onOpenTicket={overlap.onOpenTicketKey}
        />
      );
  }
}

function MomentMeta({
  moment,
  steps,
  texts,
}: {
  moment: RunMoment;
  steps?: Step[];
  texts: typeof frMoments;
}) {
  const index = steps?.findIndex((s) => s.id === moment.stepId) ?? -1;
  return (
    <span className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="font-mono">{formatClock(moment.at)}</span>
      {index >= 0 && (
        <Badge variant="outline" className="px-1.5 py-0 text-[11px] font-normal">
          {texts.step(index + 1)}
        </Badge>
      )}
    </span>
  );
}

export function Feed(props: FeedProps) {
  const { moments, showReasoning = false, highlightStep = null, label, extras = [], texts } = props;
  const shown = feedMoments(moments, {
    showReasoning,
    subagentId: props.subagentId ?? null,
    subagents: props.subagents ?? NO_SUBAGENTS,
  });
  const entries = entriesOf(shown, extras);
  const list = (
    <ol
      aria-label={label ? texts.feed(label) : undefined}
      className="grid grid-cols-[minmax(0,1fr)] content-start gap-3"
    >
      {entries.map((entry) =>
        "extra" in entry ? (
          <li key={`x-${entry.extra.key}`} data-kind={entry.extra.kind}>
            <ExchangeLine extra={entry.extra} />
          </li>
        ) : (
          <MomentItem
            key={entry.moment.seq}
            moment={entry.moment}
            highlightStep={highlightStep}
            feed={props}
          />
        ),
      )}
    </ol>
  );
  if (entries.length > 0) return list;
  return (
    <>
      {label && list}
      <p className="text-sm text-muted-foreground">{texts.empty}</p>
    </>
  );
}

function MomentItem({
  moment,
  highlightStep,
  feed,
}: {
  moment: RunMoment;
  highlightStep: string | null;
  feed: FeedProps;
}) {
  const current = highlightStep !== null && moment.stepId === highlightStep;
  return (
    <li
      data-seq={moment.seq}
      data-step={moment.stepId ?? undefined}
      data-subagent={moment.data.kind === "subagent" ? moment.data.subagentId : undefined}
      data-step-current={current || undefined}
      className={cn("grid gap-1.5 rounded-md scroll-mt-2", current && "bg-accent/40 -mx-2 px-2 py-1")}
    >
      {(moment.data.kind === "message" || moment.data.kind === "reasoning") && (
        <MomentMeta moment={moment} steps={feed.steps} texts={feed.texts} />
      )}
      <MomentBody moment={moment} {...feed} />
    </li>
  );
}
