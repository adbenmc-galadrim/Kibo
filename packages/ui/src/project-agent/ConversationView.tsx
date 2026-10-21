import type { Signal } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { AlarmClock, BookSearch, Bot, Clock, Loader2, RotateCcw } from "lucide-react";
import { formatClock } from "../agents/format";
import { useFollowBottom } from "../agents/use-follow-bottom";
import { frProjectAgent } from "../i18n/fr-project-agent";
import { AgentText } from "../moments/AgentText";
import { BatchCard, type Decision } from "./BatchCard";
import type { DiffLabels } from "./batch-groups";
import { type ConversationItem, type PanelStatus, readingText } from "./conversation";
import { READING_COLUMN } from "./reading-column";

type Props = {
  items: ConversationItem[];
  status: PanelStatus;
  readOnly: boolean;
  labels: DiffLabels;
  signals: readonly Signal[];
  onTicket(key: string): void;
  onRetry(): void;
  onDecide(batchId: string, d: Decision): Promise<unknown>;
};

const t = frProjectAgent.conversation;
const BUSY: ReadonlySet<PanelStatus> = new Set(["thinking", "queued"]);

function Item({
  item,
  readOnly,
  labels,
  signals,
  onTicket,
  onRetry,
  onDecide,
}: Props & { item: ConversationItem }) {
  switch (item.kind) {
    case "user":
      return <UserBubble text={item.text} at={item.at} />;
    case "agent":
      return (
        <li className="flex min-w-0 gap-[10px]" aria-label={t.agent}>
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-(--tracking-brand-line) bg-(--tracking-brand-soft)">
            <Bot aria-hidden className="size-[13px] text-(--tracking-brand)" />
          </span>
          <div className="min-w-0 flex-1 text-[13px] leading-[1.55]">
            <AgentText text={item.text} onTicket={onTicket} />
          </div>
        </li>
      );
    case "reading":
      return (
        <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <BookSearch className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{readingText(item.tools)}</span>
        </li>
      );
    case "batch":
      return (
        <li>
          <BatchCard
            batch={item.batch}
            labels={labels}
            signals={signals}
            afterWakeup={item.afterWakeup}
            readOnly={readOnly}
            onDecide={async (d) => {
              await onDecide(item.batch.id, d);
            }}
          />
        </li>
      );
    case "wakeup":
      return (
        <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <AlarmClock className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0">{item.text}</span>
          <time className="ml-auto shrink-0" dateTime={new Date(item.at).toISOString()}>
            {formatClock(item.at)}
          </time>
        </li>
      );
    case "event":
      return (
        <li
          className={cn(
            "flex items-center justify-between gap-2 text-xs",
            item.tone === "red" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          <span>{item.text}</span>
          {item.retry && !readOnly && (
            <Button variant="outline" size="sm" className="h-6 text-xs" onClick={onRetry}>
              <RotateCcw />
              {t.retry}
            </Button>
          )}
        </li>
      );
  }
}

function UserBubble({ text, at }: { text: string; at: number }) {
  const time = formatClock(at);
  return (
    <li
      className="flex max-w-[85%] flex-col gap-1 self-end rounded-[10px] bg-muted px-3 py-2.5"
      aria-label={t.youAt(time)}
    >
      <span className="text-[13px] leading-[1.45] whitespace-pre-wrap">{text}</span>
      <time className="text-2xs text-muted-foreground" dateTime={new Date(at).toISOString()}>
        {time}
      </time>
    </li>
  );
}

function ThinkingLine({ status }: { status: PanelStatus }) {
  if (!BUSY.has(status)) return null;
  const Icon = status === "thinking" ? Loader2 : Clock;
  return (
    <output className="flex items-center gap-1.5 text-xs text-(--tracking-brand)">
      <Icon aria-hidden className={cn("size-3.5 shrink-0", status === "thinking" && "animate-spin")} />
      {status === "thinking" ? t.thinking : t.queued}
    </output>
  );
}

export function ConversationView(props: Props) {
  const busy = BUSY.has(props.status);
  const { ref, onScroll } = useFollowBottom<HTMLDivElement>(props.items.length + (busy ? 1 : 0));
  return (
    <div ref={ref} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-[18px] py-4">
      <div className={cn(READING_COLUMN, "flex flex-col gap-[14px]")}>
        {props.items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t.empty}</p>
        ) : (
          <ol aria-label={t.label} className="flex flex-col gap-[14px]">
            {props.items.map((item) => (
              <Item key={item.id} {...props} item={item} />
            ))}
          </ol>
        )}
        <ThinkingLine status={props.status} />
      </div>
    </div>
  );
}
