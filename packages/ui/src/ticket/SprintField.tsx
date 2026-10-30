import { type SprintView, sortSprints, type TicketView } from "@kibo/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { frFeature as t } from "../i18n/fr-group";
import type { TicketCommand } from "./use-ticket-command";

type Props = {
  ticket: Pick<TicketView, "id" | "parentId" | "sprintId" | "progress">;
  sprints: readonly SprintView[];
  editable: boolean;
  command: TicketCommand;
};

const UNPLANNED = "none";

const hasSprintField = (ticket: Pick<TicketView, "parentId" | "progress">): boolean =>
  ticket.parentId === null && ticket.progress.total === 0;

export function SprintField({ ticket, sprints, editable, command }: Props) {
  if (!hasSprintField(ticket)) return null;
  const pick = (value: string) =>
    void command.run({
      method: "setTicketSprint",
      ticketId: ticket.id,
      sprintId: value === UNPLANNED ? null : value,
    });
  return (
    <Select value={ticket.sprintId ?? UNPLANNED} disabled={!editable || command.busy} onValueChange={pick}>
      <SelectTrigger size="sm" aria-label={t.ticketSprint} className="w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNPLANNED}>{t.unplanned}</SelectItem>
        {sortSprints(sprints).map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {`${s.code} · ${s.name}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
