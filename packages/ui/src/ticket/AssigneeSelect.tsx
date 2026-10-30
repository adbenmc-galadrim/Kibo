import type { Assignee, TicketView } from "@kibo/schema";
import { assigneeLabel } from "@kibo/sdk";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { frTicketEdit as t } from "../i18n/fr-ticket-edit";
import { PILL } from "./StatusSelect";
import type { TicketCommand } from "./use-ticket-command";

type Props = {
  ticket: TicketView;
  viewer: string;
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

const initials = (label: string): string =>
  label
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

function labelOf(assignee: Assignee | null, viewer: string): string {
  if (!assignee) return t.nobody;
  return assignee.ref === viewer ? t.me : assigneeLabel(assignee);
}

export function AssigneeSelect({ ticket, viewer, editable, command }: Props) {
  const assignee = ticket.assignee?.kind === "agent" ? null : ticket.assignee;
  const label = labelOf(assignee, viewer);
  if (!editable) return <span>{label}</span>;
  const pick = (value: string) =>
    void command.run({ method: "updateTicket", ticketId: ticket.id, assignee: assigneeOf(value, viewer) });
  return (
    <Select value={selectValue(assignee, viewer)} onValueChange={pick}>
      <SelectTrigger size="sm" aria-label={t.assignee} className={`${PILL} pl-1`}>
        {assignee && (
          <span
            aria-hidden
            className="grid size-5 place-items-center rounded-full border bg-(--tracking-muted) text-[8px] font-semibold"
          >
            {initials(assigneeLabel(assignee))}
          </span>
        )}
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NOBODY}>{t.nobody}</SelectItem>
        <SelectItem value={ME}>{t.me}</SelectItem>
      </SelectContent>
    </Select>
  );
}
