import type { TicketView } from "@kibo/schema";
import { fr } from "./fr";
import { cn } from "./lib/utils";

type Props = { ticket: Pick<TicketView, "key" | "keyLabel">; className?: string };

export function TicketKeyLabel({ ticket, className }: Props) {
  const pending = ticket.key === null;
  return (
    <span
      className={cn(pending && "italic opacity-70", className)}
      title={pending ? fr.pendingKey : undefined}
    >
      {ticket.keyLabel}
    </span>
  );
}
