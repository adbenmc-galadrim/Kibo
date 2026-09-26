import type { RunState, TicketRun } from "@kibo/schema";
import { Bot } from "lucide-react";
import { cn } from "./lib/utils";
import { RUN_TEXT, RunDot } from "./status";
import { Badge } from "./ui/badge";

export type RunBadgeTexts = { queued: (position: number | null) => string; waiting: string; failed: string };

const SHOWN: readonly RunState[] = ["queued", "starting", "running", "waiting_input", "failed"];

export const liveRun = (run: TicketRun | null): TicketRun | null =>
  run && SHOWN.includes(run.state) ? run : null;

function stateText(run: TicketRun, texts: RunBadgeTexts): string | null {
  if (run.state === "queued") return texts.queued(run.position);
  if (run.state === "waiting_input") return texts.waiting;
  if (run.state === "failed") return texts.failed;
  return null;
}

type Props = { agent: string | null; run: TicketRun | null; texts: RunBadgeTexts; className?: string };

export function AgentBadge({ agent, run, texts, className }: Props) {
  const live = liveRun(run);
  const name = live?.label ?? agent;
  if (!name) return null;
  const text = live && stateText(live, texts);
  return (
    <Badge variant="outline" className={cn("gap-1 text-3xs font-normal text-muted-foreground", className)}>
      {live && <RunDot state={live.state} className="size-1.5" />}
      <Bot aria-hidden className="size-3" />
      <span className="font-mono text-foreground/80">{name}</span>
      {live && text && <span className={RUN_TEXT[live.state]}>{`· ${text}`}</span>}
    </Badge>
  );
}
