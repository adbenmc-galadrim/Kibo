import type { TicketView } from "@kibo/schema";
import { Switch } from "@kibo/sdk/ui/switch";
import { frFeature as t } from "../i18n/fr-group";
import type { TicketCommand } from "./use-ticket-command";

type Props = {
  ticket: Pick<TicketView, "id" | "parentId" | "optional">;
  editable: boolean;
  command: TicketCommand;
};

export function OptionalToggle({ ticket, editable, command }: Props) {
  if (ticket.parentId === null) return null;
  return (
    <span className="flex items-center gap-2">
      <Switch
        aria-label={t.optional}
        checked={ticket.optional}
        disabled={!editable || command.busy}
        onCheckedChange={(optional) =>
          void command.run({ method: "setTicketOptional", ticketId: ticket.id, optional })
        }
      />
      <span className="text-muted-foreground">{t.optionalHint}</span>
    </span>
  );
}
