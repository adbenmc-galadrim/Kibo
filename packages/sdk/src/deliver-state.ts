import {
  FINAL_STATUSES,
  isTerminal,
  NOT_STARTED_STATUSES,
  type TicketRun,
  type TicketView,
} from "@kibo/schema";
import { Truck } from "lucide-react";
import { deliveryTexts } from "./fr-delivery";
import type { MenuAction } from "./ui/menu-entries";

export type DeliverEntry = { disabledReason: string | null };
export type DeliverInput = {
  ticket: Pick<TicketView, "key" | "statusId" | "startable" | "waitingOn">;
  editable: boolean;
  agentKnown: boolean;
  parent: boolean;
  run: Pick<TicketRun, "label" | "state"> | null;
};

function disabledReason({ ticket, parent, run }: DeliverInput): string | null {
  if (run && !isTerminal(run.state)) return deliveryTexts.busy(run.label);
  if (parent || ticket.startable || !NOT_STARTED_STATUSES.includes(ticket.statusId)) return null;
  return ticket.waitingOn.length > 0
    ? deliveryTexts.blockedBy(ticket.waitingOn)
    : deliveryTexts.blockingQuestion;
}

export function deliverEntry(input: DeliverInput): DeliverEntry | null {
  const { ticket, editable, agentKnown } = input;
  if (!editable || !agentKnown || ticket.key === null || FINAL_STATUSES.includes(ticket.statusId))
    return null;
  return { disabledReason: disabledReason(input) };
}

export const deliverMenuActions = (entry: DeliverEntry | null, onSelect: () => void): MenuAction[] =>
  entry === null
    ? []
    : [
        {
          label: deliveryTexts.deliver,
          icon: Truck,
          disabled: entry.disabledReason !== null,
          hint: entry.disabledReason ?? undefined,
          onSelect,
        },
      ];
