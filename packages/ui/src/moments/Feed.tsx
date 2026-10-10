import type { FileRef, RunMoment, Step } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Badge } from "@kibo/sdk/ui/badge";
import { formatClock } from "../agents/format";
import type { frMoments } from "../i18n/fr-moments";
import { ActionsMoment } from "./ActionsMoment";
import type { FileContext } from "./file-context";
import { MessageMoment } from "./MessageMoment";
import { RawMoment } from "./RawMoment";
import { ReminderMoment } from "./ReminderMoment";

export type FeedProps = {
  moments: RunMoment[];
  showReasoning?: boolean;
  onOpenFile?(ref: FileRef): void;
  files?: FileContext | null;
  highlightStep?: string | null;
  steps?: Step[];
  label?: string;
  texts: typeof frMoments;
};

function MomentBody({
  moment,
  files,
  onOpenFile,
  texts,
}: { moment: RunMoment } & Omit<FeedProps, "moments">) {
  const data = moment.data;
  switch (data.kind) {
    case "message":
      return <MessageMoment text={data.text} />;
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
    case "raw":
      return <RawMoment text={data.text} partial={data.partial} />;
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
  const { moments, showReasoning = false, highlightStep = null, label, texts } = props;
  const shown = moments.filter((m) => showReasoning || m.data.kind !== "reasoning");
  if (shown.length === 0) return <p className="text-sm text-muted-foreground">{texts.empty}</p>;
  return (
    <ol aria-label={label ? texts.feed(label) : undefined} className="grid content-start gap-3">
      {shown.map((moment) => (
        <li
          key={moment.seq}
          data-seq={moment.seq}
          data-step={moment.stepId ?? undefined}
          data-step-current={(highlightStep !== null && moment.stepId === highlightStep) || undefined}
          className={cn(
            "grid gap-1.5 rounded-md scroll-mt-2",
            highlightStep !== null && moment.stepId === highlightStep && "bg-accent/40 -mx-2 px-2 py-1",
          )}
        >
          {(moment.data.kind === "message" || moment.data.kind === "reasoning") && (
            <MomentMeta moment={moment} steps={props.steps} texts={texts} />
          )}
          <MomentBody moment={moment} {...props} />
        </li>
      ))}
    </ol>
  );
}
