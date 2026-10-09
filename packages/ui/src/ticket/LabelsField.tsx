import { LabelName, type TicketView } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Input } from "@kibo/sdk/ui/input";
import { X } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { frLabels } from "../i18n/fr-labels";
import type { TicketCommand } from "./use-ticket-command";

type Props = { ticket: TicketView; editable: boolean; command: TicketCommand };

export function LabelsField({ ticket, editable, command }: Props) {
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);
  if (!editable && ticket.labels.length === 0) return null;
  const save = (labels: string[]) =>
    void command.run({ method: "updateTicket", ticketId: ticket.id, labels });
  const add = () => {
    const label = draft.trim();
    if (!LabelName.safeParse(label).success) return setInvalid(true);
    setInvalid(false);
    setDraft("");
    if (!ticket.labels.includes(label)) save([...ticket.labels, label].sort());
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    add();
  };
  const problem = invalid ? frLabels.invalid : command.error;
  return (
    <fieldset aria-label={frLabels.title} className="flex min-w-0 flex-wrap items-center gap-1">
      {ticket.labels.map((label) => (
        <Badge key={label} variant="outline" className="gap-1 font-mono text-2xs">
          {label}
          {editable && (
            <button
              type="button"
              aria-label={frLabels.remove(label)}
              className="rounded-sm text-muted-foreground hover:text-foreground"
              onClick={() => save(ticket.labels.filter((l) => l !== label))}
            >
              <X aria-hidden className="size-3" />
            </button>
          )}
        </Badge>
      ))}
      {editable && (
        <Input
          aria-label={frLabels.add}
          placeholder={frLabels.add}
          value={draft}
          aria-invalid={invalid}
          className="h-6 w-48 text-xs"
          onChange={(e) => {
            setDraft(e.target.value);
            setInvalid(false);
          }}
          onKeyDown={onKeyDown}
        />
      )}
      {problem && (
        <p role="alert" className="w-full text-xs text-destructive">
          {problem}
        </p>
      )}
    </fieldset>
  );
}
