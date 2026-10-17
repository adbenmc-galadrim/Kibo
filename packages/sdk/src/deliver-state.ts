import {
  type AgentExecution,
  type DeliveryKind,
  deliveryBrief,
  FINAL_STATUSES,
  isTerminal,
  NOT_STARTED_STATUSES,
  type TicketRun,
  type TicketView,
  updateDeliveryBrief,
} from "@kibo/schema";
import { Copy, Truck } from "lucide-react";
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

export function retouchEntry(input: DeliverInput): DeliverEntry | null {
  const { ticket, editable, agentKnown, run } = input;
  if (!editable || !agentKnown || ticket.key === null || !FINAL_STATUSES.includes(ticket.statusId))
    return null;
  return { disabledReason: run && !isTerminal(run.state) ? deliveryTexts.busy(run.label) : null };
}

export const menuDeliverEntry = (input: DeliverInput): DeliverEntry | null =>
  FINAL_STATUSES.includes(input.ticket.statusId) ? retouchEntry(input) : deliverEntry(input);

export const updateBrief = updateDeliveryBrief;

export const deliverMenuActions = (
  entry: DeliverEntry | null,
  onSelect: () => void,
  label: string = deliveryTexts.deliver,
): MenuAction[] =>
  entry === null
    ? []
    : [
        {
          label,
          icon: Truck,
          disabled: entry.disabledReason !== null,
          hint: entry.disabledReason ?? undefined,
          onSelect,
        },
      ];

export type DeliveryMenu = {
  execution: AgentExecution;
  entry: DeliverEntry | null;
  ticket: Pick<TicketView, "key" | "statusId">;
  deliver(mode: DeliveryKind): void;
  copy(command: string): void;
};

export function deliveryMenuActions(menu: DeliveryMenu): MenuAction[] {
  const { key, statusId } = menu.ticket;
  const retouch = FINAL_STATUSES.includes(statusId);
  if (menu.execution === "shown")
    return retouch
      ? deliverMenuActions(menu.entry, () => menu.deliver("update"), deliveryTexts.retouch)
      : deliverMenuActions(menu.entry, () => menu.deliver("delivery"));
  if (key === null) return [];
  const command = retouch ? updateBrief(key) : deliveryBrief(key);
  return [{ label: deliveryTexts.copy(command), icon: Copy, onSelect: () => menu.copy(command) }];
}

export const copyDeliveryCommand = (command: string): Promise<void> =>
  navigator.clipboard
    .writeText(command)
    .catch((e: unknown) => console.warn("[kibo-sdk] clipboard write refused", e));
