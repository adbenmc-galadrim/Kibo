import { LinkifiedText } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { Textarea } from "@kibo/sdk/ui/textarea";
import { useState } from "react";
import { fr } from "../i18n/fr";
import { frTicketEdit as t } from "../i18n/fr-ticket-edit";
import type { TicketCommand } from "./use-ticket-command";

type Props = {
  ticketId: string;
  description: string;
  editable: boolean;
  command: TicketCommand;
  onOpenFile(ref: { path: string; line: number | null }): void;
};

export function DescriptionEditor({ ticketId, description, editable, command, onOpenFile }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const save = async () => {
    if (draft === null) return;
    if (await command.run({ method: "updateTicket", ticketId, description: draft })) setDraft(null);
  };
  return (
    <section className="grid gap-2 px-4 text-sm">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-medium">{fr.ticket.description}</h3>
        {editable && draft === null && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => setDraft(description)}
          >
            {t.editDescription}
          </Button>
        )}
      </div>
      {draft === null ? (
        <p className="whitespace-pre-wrap text-muted-foreground">
          {description ? <LinkifiedText text={description} onOpen={onOpenFile} /> : "-"}
        </p>
      ) : (
        <div className="grid gap-2">
          <Textarea
            aria-label={t.descriptionField}
            value={draft}
            placeholder={t.descriptionPlaceholder}
            autoFocus
            className="min-h-32"
            onChange={(e) => setDraft(e.target.value)}
          />
          {command.error && (
            <p role="alert" className="text-xs text-destructive">
              {command.error}
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" disabled={command.busy} onClick={() => void save()}>
              {t.save}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
              {t.cancel}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
