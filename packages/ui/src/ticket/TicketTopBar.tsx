import type { TicketView } from "@kibo/schema";
import { TicketKeyLabel } from "@kibo/sdk";
import { Ticket } from "lucide-react";
import type { ReactNode } from "react";
import { CopyCommandButton, CopyLinkButton } from "./CopyCommandButton";

type Props = {
  projectId: string;
  ticket: TicketView;
  copy: boolean;
  actions: ReactNode;
  close?: ReactNode;
};

export function TicketTopBar({ projectId, ticket, copy, actions, close }: Props) {
  return (
    <div className="flex h-[52px] shrink-0 items-center gap-2 border-b border-(--tracking-soft) pr-4 pl-6">
      <Ticket aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
      <TicketKeyLabel
        ticket={ticket}
        className="font-mono text-[12.5px] whitespace-nowrap text-muted-foreground"
      />
      <span className="ml-auto flex items-center gap-1">
        {copy && <CopyCommandButton ticket={ticket} />}
        <CopyLinkButton projectId={projectId} ticketId={ticket.id} />
        {actions}
        {close}
      </span>
    </div>
  );
}
