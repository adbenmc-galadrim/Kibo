import type { ProjectSnapshot, TicketView } from "@kibo/schema";
import { StatusDot } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { X } from "lucide-react";
import { frTicketEdit as t } from "../i18n/fr-ticket-edit";
import { AddLinkForm } from "./AddLinkForm";
import { type LinkedTicket, linksOf } from "./links";
import { useTicketCommand } from "./use-ticket-command";

type Props = {
  project: ProjectSnapshot;
  ticket: TicketView;
  editable: boolean;
  onOpenTicket(ticketId: string): void;
};

type GroupProps = {
  name: string;
  items: LinkedTicket[];
  editable: boolean;
  onOpen(ticketId: string): void;
  onRemove(linkId: string): void;
};

function Group({ name, items, editable, onOpen, onRemove }: GroupProps) {
  if (items.length === 0) return null;
  return (
    <fieldset className="m-0 grid min-w-0 gap-1 border-0 p-0">
      <legend className="mb-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
        {name}
      </legend>
      <ul className="grid gap-0.5">
        {items.map(({ link, ticket }) => (
          <li key={link.id} className="flex items-center gap-1">
            <button
              type="button"
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-accent",
                ticket.statusId === "done" && "text-muted-foreground",
              )}
              onClick={() => onOpen(ticket.id)}
            >
              <StatusDot statusId={ticket.statusId} />
              <span className="font-mono text-2xs">{ticket.keyLabel}</span>{" "}
              <span className="truncate">{ticket.title}</span>
            </button>
            {editable && (
              <Button
                size="icon"
                variant="ghost"
                className="size-6"
                aria-label={t.deps.remove(ticket.keyLabel)}
                onClick={() => onRemove(link.id)}
              >
                <X className="size-3.5" />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

export function DependenciesSection({ project, ticket, editable, onOpenTicket }: Props) {
  const command = useTicketCommand(project.meta.id);
  const links = linksOf(project, ticket.id);
  const remove = (linkId: string) => void command.run({ method: "removeLink", linkId });
  const empty = links.blockedBy.length + links.blocks.length + links.related.length === 0;
  if (empty && !editable) return null;
  const group = (name: string, items: LinkedTicket[]) => (
    <Group name={name} items={items} editable={editable} onOpen={onOpenTicket} onRemove={remove} />
  );
  return (
    <section aria-label={t.deps.title} className="grid gap-3 px-4 text-xs">
      <h3 className="font-medium">{t.deps.title}</h3>
      {group(t.deps.blockedBy, links.blockedBy)}
      {group(t.deps.blocks, links.blocks)}
      {group(t.deps.related, links.related)}
      {command.error && (
        <p role="alert" className="text-destructive">
          {command.error}
        </p>
      )}
      {editable && <AddLinkForm project={project} ticket={ticket} />}
    </section>
  );
}
