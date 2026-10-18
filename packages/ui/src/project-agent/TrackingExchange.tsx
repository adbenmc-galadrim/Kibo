import { cn } from "@kibo/sdk/lib/utils";
import { Bot } from "lucide-react";
import { formatClock } from "../agents/format";
import { frProjectAgent } from "../i18n/fr-project-agent";
import { AgentText } from "../moments/AgentText";
import { type ConversationItem, readingText } from "./conversation";

type Props = { items: readonly ConversationItem[]; onTicket(key: string): void };

const t = frProjectAgent;
const ANSWER =
  "grid gap-[8px] text-[13px] leading-[20px] text-(--tracking-fg) [&_p]:m-0 [&>:first-child]:text-(--tracking-fg)";

function Item({ item, onTicket }: { item: ConversationItem; onTicket(key: string): void }) {
  switch (item.kind) {
    case "user":
      return (
        <li aria-label={t.conversation.you} className="ml-[60px] flex flex-col items-stretch gap-[4px]">
          <p className="rounded-[10px] bg-(--tracking-muted) px-[12px] py-[9px] text-[13px] leading-[18px] whitespace-pre-wrap text-(--tracking-fg)">
            {item.text}
          </p>
          <span className="px-[12px] text-[11.5px] leading-[14px] text-(--tracking-mfg)">
            {t.tracking.asked(formatClock(item.at))}
          </span>
        </li>
      );
    case "agent":
      return (
        <li aria-label={t.conversation.agent} className="flex gap-[10px]">
          <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full border border-(--tracking-brand-line) bg-(--tracking-brand-soft)">
            <Bot aria-hidden className="size-[13px] text-(--tracking-brand)" />
          </span>
          <AgentText text={item.text} onTicket={onTicket} className={ANSWER} />
        </li>
      );
    case "reading":
      return (
        <li className="truncate pl-[32px] text-[11.5px] leading-[14px] text-(--tracking-mfg)">
          {readingText(item.tools)}
        </li>
      );
    case "event":
      return (
        <li
          className={cn(
            "pl-[32px] text-[12px] leading-[15px]",
            item.tone === "red" ? "text-destructive" : "text-(--tracking-mfg)",
          )}
        >
          {item.text}
        </li>
      );
    case "batch":
      return null;
  }
}

export function TrackingExchange({ items, onTicket }: Props) {
  return (
    <ol aria-label={t.tracking.exchange} className="flex flex-col gap-[14px]">
      {items.map((item) => (
        <Item key={item.id} item={item} onTicket={onTicket} />
      ))}
    </ol>
  );
}
