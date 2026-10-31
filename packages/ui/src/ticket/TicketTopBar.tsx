import { FINAL_STATUSES, type TicketView } from "@kibo/schema";
import { LaunchInT3Button } from "@kibo/sdk/t3";
import type { ReactNode } from "react";
import { ShellT3Provider } from "../shell/ShellT3Provider";
import { CopyLinkButton } from "./CopyCommandButton";
import { KeyCopyButton } from "./KeyCopyButton";

type Props = {
  projectId: string;
  ticket: TicketView;
  folder: string | null;
  launch: boolean;
  actions: ReactNode;
  close?: ReactNode;
};

export function TicketTopBar({ projectId, ticket, folder, launch, actions, close }: Props) {
  return (
    <div className="flex h-[52px] shrink-0 items-center gap-2 border-b border-(--tracking-soft) pr-4 pl-6">
      <KeyCopyButton ticket={ticket} />
      <span className="ml-auto flex items-center gap-2">
        {launch && ticket.key !== null && (
          <ShellT3Provider>
            <LaunchInT3Button
              projectId={projectId}
              ticketKey={ticket.key}
              done={FINAL_STATUSES.includes(ticket.statusId)}
              thread={ticket.thread}
              folderMissing={folder === null}
            />
          </ShellT3Provider>
        )}
        <CopyLinkButton projectId={projectId} ticketId={ticket.id} />
        {actions}
        {close}
      </span>
    </div>
  );
}
