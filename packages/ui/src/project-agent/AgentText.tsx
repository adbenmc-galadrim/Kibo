import { lazyPanel } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import type { AgentMarkdownProps } from "@kibo/sdk/markdown";
import { fr } from "../i18n/fr";
import { frMarkdown } from "../i18n/fr-markdown";

const AgentMarkdown = lazyPanel<AgentMarkdownProps>(
  () => import("@kibo/sdk/markdown").then((m) => m.AgentMarkdownView),
  fr.lazy,
  { fallback: "children" },
);

type Props = { text: string; className?: string; onTicket?: (key: string) => void };

export function AgentText({ text, className, onTicket }: Props) {
  return (
    <AgentMarkdown text={text} labels={frMarkdown} onTicket={onTicket} className={className}>
      <p className={cn("break-words whitespace-pre-wrap", className)}>{text}</p>
    </AgentMarkdown>
  );
}
