import { branchRefOf, type TicketView } from "@kibo/schema";
import { type TooltipRow, TooltipRows } from "@kibo/sdk/ui/tooltip-rows";
import type { ReactElement } from "react";
import { waitedKeys } from "./card-signal";
import { fr } from "./fr";

type TooltipTicket = Pick<
  TicketView,
  "labels" | "externalRefs" | "onHold" | "waitingOn" | "startReason" | "openQuestions" | "blockedReason"
>;

const mono = (text: string) => <span className="font-mono">{text}</span>;

function heldText(ticket: TooltipTicket): string | null {
  const hold = ticket.onHold;
  if (hold !== null) return hold.source === "own" ? hold.reason : hold.key;
  const keys = waitedKeys(ticket);
  return keys.length > 0 ? keys.join(", ") : null;
}

export function cardTooltipRows(ticket: TooltipTicket): TooltipRow[] {
  const texts = fr.tooltip;
  const branch = branchRefOf(ticket.externalRefs)?.branch ?? null;
  const held = heldText(ticket);
  const rows: (TooltipRow | null)[] = [
    ticket.labels.length > 0 ? [texts.labels, mono(ticket.labels.join(", "))] : null,
    branch !== null ? [texts.branch, mono(branch)] : null,
    held !== null ? [texts.held, held] : null,
    ticket.openQuestions > 0 ? [texts.questions, texts.open(ticket.openQuestions)] : null,
    ticket.blockedReason ? [texts.reason, ticket.blockedReason] : null,
  ];
  return rows.filter((row) => row !== null);
}

type Props = { ticket: TooltipTicket; suppressed: boolean; children: ReactElement };

export function CardTooltip({ ticket, suppressed, children }: Props) {
  return (
    <TooltipRows rows={cardTooltipRows(ticket)} suppressed={suppressed}>
      {children}
    </TooltipRows>
  );
}
