import type { TicketView } from "@kibo/schema";
import { Bot } from "lucide-react";
import { cn } from "./lib/utils";
import { Badge } from "./ui/badge";

export function AgentBadge({ agent, className }: { agent: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1 text-3xs font-normal text-muted-foreground", className)}>
      <Bot aria-hidden className="size-3 shrink-0" />
      <span className="truncate font-mono text-foreground/80">{agent}</span>
    </Badge>
  );
}

export const withoutAgentAssignee = <T extends Pick<TicketView, "assignee">>(ticket: T): T =>
  ticket.assignee?.kind === "agent" ? { ...ticket, assignee: null } : ticket;
