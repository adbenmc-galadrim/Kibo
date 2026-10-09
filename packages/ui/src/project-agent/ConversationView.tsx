import { renderMarkdownLite } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { BookSearch, RotateCcw } from "lucide-react";
import { useFollowBottom } from "../agents/use-follow-bottom";
import { frProjectAgent } from "../i18n/fr-project-agent";
import { BatchCard, type Decision } from "./BatchCard";
import type { DiffLabels } from "./batch-groups";
import type { ConversationItem } from "./conversation";

type Props = {
  items: ConversationItem[];
  readOnly: boolean;
  labels: DiffLabels;
  onTicket(key: string): void;
  onRetry(): void;
  onDecide(batchId: string, d: Decision): Promise<void>;
};

const t = frProjectAgent.conversation;

function readingText(tools: readonly string[]): string {
  return t.reading(
    tools.map((tool) => {
      const [name = "", ...rest] = tool.split(" ");
      return t.tool(name, rest.length > 0 ? rest.join(" ") : null);
    }),
  );
}

function Item({ item, readOnly, labels, onTicket, onRetry, onDecide }: Props & { item: ConversationItem }) {
  switch (item.kind) {
    case "user":
      return (
        <li
          className="ml-8 self-end rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap"
          aria-label={t.you}
        >
          {item.text}
        </li>
      );
    case "agent":
      return (
        <li className="grid gap-2 text-sm leading-relaxed" aria-label={t.agent}>
          {renderMarkdownLite(item.text, { onTicket })}
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
            readOnly={readOnly}
            onDecide={(d) => onDecide(item.batch.id, d)}
          />
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

export function ConversationView(props: Props) {
  const { ref, onScroll } = useFollowBottom<HTMLDivElement>(props.items.length);
  return (
    <div ref={ref} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
      {props.items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t.empty}</p>
      ) : (
        <ol aria-label={t.label} className="flex flex-col gap-3">
          {props.items.map((item) => (
            <Item key={item.id} {...props} item={item} />
          ))}
        </ol>
      )}
    </div>
  );
}
