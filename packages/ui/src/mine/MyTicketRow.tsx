import type { Domain, Status, TicketView } from "@kibo/schema";
import { StatusDot } from "@kibo/sdk";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@kibo/sdk/ui/tooltip";
import { Bot, FolderInput } from "lucide-react";
import { fr } from "../i18n/fr";
import type { MineTab } from "./my-tickets";

type Props = {
  ticket: TicketView;
  tab: MineTab;
  domain: Domain | null;
  agent: string | null;
  workflow: readonly Status[];
  canRun: boolean;
  inbox: boolean;
  onOpen(): void;
  onAssign(): void;
  onFile(): void;
};

function AgentName({ name }: { name: string }) {
  return (
    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Bot aria-hidden className="size-4" />
      {name}
    </span>
  );
}

function AssignAction({ canRun, onAssign }: { canRun: boolean; onAssign(): void }) {
  if (canRun)
    return (
      <Button variant="ghost" size="sm" className="h-7" onClick={onAssign}>
        <Bot aria-hidden />
        {fr.mine.assign}
      </Button>
    );
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="block">
          <Button variant="ghost" size="icon" className="size-7" aria-label={fr.mine.assign} disabled>
            <Bot aria-hidden />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{fr.mine.noFolder}</TooltipContent>
    </Tooltip>
  );
}

function FileAction({ onFile }: { onFile(): void }) {
  return (
    <Button variant="ghost" size="sm" className="h-7" title={fr.mine.noFolderInbox} onClick={onFile}>
      <FolderInput aria-hidden />
      {fr.mine.file}
    </Button>
  );
}

export function MyTicketRow({
  ticket,
  tab,
  domain,
  agent,
  workflow,
  canRun,
  inbox,
  onOpen,
  onAssign,
  onFile,
}: Props) {
  const status = workflow.find((s) => s.id === ticket.statusId)?.label ?? ticket.statusId;
  return (
    <li className="flex h-12 items-center gap-3 rounded-lg border bg-card pr-4">
      <button
        type="button"
        aria-label={`${ticket.keyLabel} ${ticket.title}`}
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 self-stretch rounded-lg pl-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <StatusDot statusId={ticket.statusId} />
        <span className="shrink-0 font-mono text-2xs text-muted-foreground">{ticket.keyLabel}</span>
        <span className="truncate text-sm">{ticket.title}</span>
      </button>
      {domain && (
        <Badge variant="outline" className="gap-1 text-3xs text-muted-foreground">
          <span aria-hidden className="size-1.5 rounded-[1px]" style={{ background: domain.color }} />
          {domain.name}
        </Badge>
      )}
      <span className="w-24 shrink-0 text-sm text-muted-foreground">{status}</span>
      {tab === "agents" && agent ? (
        <AgentName name={agent} />
      ) : inbox ? (
        <FileAction onFile={onFile} />
      ) : (
        <AssignAction canRun={canRun} onAssign={onAssign} />
      )}
    </li>
  );
}
