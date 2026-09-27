import type { Assignee, MemberInfo, TicketView } from "@kibo/schema";
import { assigneeLabel } from "@kibo/sdk";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { useId } from "react";
import { frTicketEdit as t } from "../i18n/fr-ticket-edit";
import type { TicketCommand } from "./use-ticket-command";

type Props = {
  ticket: TicketView;
  viewer: string;
  members: MemberInfo[];
  editable: boolean;
  command: TicketCommand;
};

const NOBODY = "none";
const ME = "me";

function assigneeOf(value: string, viewer: string): Assignee | null {
  if (value === NOBODY) return null;
  return { kind: "human", ref: value === ME ? viewer : value };
}

function selectValue(assignee: Assignee | null, viewer: string): string {
  if (!assignee) return NOBODY;
  return assignee.ref === viewer ? ME : assignee.ref;
}

export function AssigneeSelect({ ticket, viewer, members, editable, command }: Props) {
  const hintId = useId();
  const others = members.filter((m) => m.userId !== viewer);
  const label = ticket.assignee ? assigneeLabel(ticket.assignee, members) : t.nobody;
  if (!editable) return <span>{label}</span>;
  const agent = ticket.assignee?.kind === "agent";
  const pick = (value: string) =>
    void command.run({ method: "updateTicket", ticketId: ticket.id, assignee: assigneeOf(value, viewer) });
  return (
    <span className="grid gap-1">
      <Select
        value={agent ? ticket.assignee?.ref : selectValue(ticket.assignee, viewer)}
        onValueChange={pick}
        disabled={agent}
      >
        <SelectTrigger
          size="sm"
          aria-label={t.assignee}
          aria-describedby={agent ? hintId : undefined}
          className="w-48"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {agent && ticket.assignee && (
            <SelectItem value={ticket.assignee.ref}>{ticket.assignee.ref}</SelectItem>
          )}
          <SelectItem value={NOBODY}>{t.nobody}</SelectItem>
          <SelectItem value={ME}>{t.me}</SelectItem>
          {others.map((m) => (
            <SelectItem key={m.userId} value={m.userId}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {agent && (
        <span id={hintId} className="text-xs text-muted-foreground">
          {t.agentAssignee}
        </span>
      )}
    </span>
  );
}
