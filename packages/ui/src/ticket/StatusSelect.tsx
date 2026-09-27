import type { Status, TicketView } from "@kibo/schema";
import { StatusDot } from "@kibo/sdk";
import { ReasonDialog } from "@kibo/sdk/ui/reason-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { useState } from "react";
import { fr } from "../i18n/fr";
import { frTicketEdit as t } from "../i18n/fr-ticket-edit";
import type { TicketCommand } from "./use-ticket-command";

type Props = { ticket: TicketView; workflow: Status[]; editable: boolean; command: TicketCommand };

export function StatusSelect({ ticket, workflow, editable, command }: Props) {
  const [blocking, setBlocking] = useState(false);
  const label = workflow.find((s) => s.id === ticket.statusId)?.label ?? ticket.statusId;
  if (!editable) return <span>{label}</span>;
  const pick = (value: string) => {
    const statusId = workflow.find((s) => s.id === value)?.id;
    if (!statusId || statusId === ticket.statusId) return;
    if (statusId === "blocked") setBlocking(true);
    else void command.run({ method: "setStatus", ticketId: ticket.id, statusId });
  };
  const block = async (reason: string) => {
    if (await command.run({ method: "setStatus", ticketId: ticket.id, statusId: "blocked", reason }))
      setBlocking(false);
  };
  return (
    <>
      <Select value={ticket.statusId} onValueChange={pick}>
        <SelectTrigger size="sm" aria-label={fr.ticket.status} className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[...workflow]
            .sort((a, b) => a.order - b.order)
            .map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <StatusDot statusId={s.id} />
                {s.label}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      {blocking && (
        <ReasonDialog
          open
          title={t.block.title(ticket.keyLabel)}
          description={t.block.description}
          label={t.block.reason}
          placeholder={t.block.placeholder}
          confirmLabel={t.block.confirm}
          cancelLabel={t.block.cancel}
          error={command.error}
          onConfirm={(reason) => void block(reason)}
          onCancel={() => {
            command.clearError();
            setBlocking(false);
          }}
        />
      )}
    </>
  );
}
