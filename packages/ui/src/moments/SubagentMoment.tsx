import type { FileRef, RunSubagent } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@kibo/sdk/ui/collapsible";
import { Bot, ChevronRight, CircleCheck, CircleX, LoaderCircle } from "lucide-react";
import { formatClock } from "../agents/format";
import { frSubagents } from "../i18n/fr-subagents";
import type { FileContext } from "./file-context";
import { SubagentFeed } from "./SubagentFeed";

type Props = {
  subagent: RunSubagent;
  subagents: ReadonlyMap<string, RunSubagent>;
  now: number;
  files?: FileContext | null;
  onOpenFile?(ref: FileRef): void;
};

const t = frSubagents;

export function subagentStateText(s: RunSubagent, now: number): string {
  if (s.state === "failed") return t.failed;
  if (s.state === "running") return t.running(now - s.startedAt);
  return t.done((s.endedAt ?? now) - s.startedAt);
}

const STATE_ICON = { running: LoaderCircle, done: CircleCheck, failed: CircleX } as const;

const STATE_TONE = {
  running: "text-blue-600 dark:text-blue-500",
  done: "text-muted-foreground",
  failed: "text-destructive",
} as const;

export function SubagentState({ subagent, text }: { subagent: RunSubagent; text: string }) {
  const Icon = STATE_ICON[subagent.state];
  const tone = STATE_TONE[subagent.state];
  return (
    <span className="flex shrink-0 items-center gap-1">
      <Icon
        aria-hidden
        className={cn(
          "size-3.5",
          tone,
          subagent.state === "running" && "animate-spin",
          subagent.state === "done" && "text-green-600 dark:text-green-500",
        )}
      />
      <span className={tone}>{text}</span>
    </span>
  );
}

function PromptBlock({ prompt }: { prompt: string }) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex items-center gap-1.5 text-xs font-medium">
        <ChevronRight
          aria-hidden
          className="size-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-90"
        />
        {t.prompt}
        <span className="font-normal text-muted-foreground">{`· ${t.promptSize(prompt.length)}`}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="mt-1.5 max-h-64 overflow-auto rounded-md bg-muted p-2 font-mono text-[11px] whitespace-pre-wrap">
          {prompt}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

const stateDetail = (s: RunSubagent, now: number): string =>
  t.detail(s.state === "running" ? t.inProgress : subagentStateText(s, now), s.actions);

function Details({ subagent, now }: { subagent: RunSubagent; now: number }) {
  return (
    <dl className="grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1 text-xs">
      <dt className="text-muted-foreground">{t.stateLabel}</dt>
      <dd>{stateDetail(subagent, now)}</dd>
      {subagent.model && (
        <>
          <dt className="text-muted-foreground">{t.model}</dt>
          <dd>{t.requested(subagent.model)}</dd>
        </>
      )}
    </dl>
  );
}

export function SubagentMoment({ subagent, subagents, now, files, onOpenFile }: Props) {
  const state = subagentStateText(subagent, now);
  return (
    <Collapsible data-subagent={subagent.id} className="grid gap-2 rounded-md border px-3 py-2">
      <CollapsibleTrigger
        aria-label={t.title(subagent.type, subagent.description, state)}
        className="group flex w-full min-w-0 items-center gap-2 text-left text-xs"
      >
        <ChevronRight
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90"
        />
        <Bot aria-hidden className="size-4 shrink-0 text-brand-strong dark:text-brand" />
        <span className="shrink-0 text-muted-foreground">{t.label}</span>
        <span className="shrink-0 font-mono font-semibold text-brand-strong dark:text-brand">
          {subagent.type}
        </span>
        <span className="min-w-0 flex-1 truncate">{`· ${subagent.description}`}</span>
        <SubagentState subagent={subagent} text={state} />
        <span className="shrink-0 font-mono text-muted-foreground">{formatClock(subagent.startedAt)}</span>
      </CollapsibleTrigger>
      {subagent.result && (
        <p className="pl-[3.25rem] text-xs text-muted-foreground">{t.result(subagent.result)}</p>
      )}
      <CollapsibleContent className="grid gap-2 pl-[3.25rem]">
        {subagent.prompt && <PromptBlock prompt={subagent.prompt} />}
        <Details subagent={subagent} now={now} />
        <SubagentFeed
          subagent={subagent}
          subagents={subagents}
          now={now}
          files={files}
          onOpenFile={onOpenFile}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}
