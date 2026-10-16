import type { TicketRun } from "@kibo/schema";
import { AgentBadge, AgentMention, liveRun, RUN_TEXT, RunDot, useAgentMention } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { Badge } from "@kibo/sdk/ui/badge";
import { Bot } from "lucide-react";
import { fr } from "./fr";

const stateText = (run: TicketRun): string | null => {
  if (run.state === "queued") return fr.run.queued(run.position);
  if (run.state === "waiting_input") return fr.run.waiting;
  if (run.state === "failed") return fr.run.failed;
  return null;
};

type Props = { agent: string | null; run: TicketRun | null; className?: string };

export function AgentChip({ agent, run, className }: Props) {
  const handlers = useAgentMention();
  const live = liveRun(run);
  if (!live) return <AgentBadge agent={agent} run={null} texts={fr.run} className={className} />;
  const text = stateText(live);
  return (
    <Badge variant="outline" className={cn("gap-1 text-3xs font-normal text-muted-foreground", className)}>
      <RunDot state={live.state} className="size-1.5" />
      <Bot absoluteStrokeWidth size={12} aria-hidden className="size-3" />
      <AgentMention
        runId={live.runId}
        label={live.label}
        texts={fr.mention}
        peek={handlers.peek}
        onOpen={handlers.onOpen}
        className="text-foreground/80"
      />
      {text && <span className={RUN_TEXT[live.state]}>{`· ${text}`}</span>}
    </Badge>
  );
}
