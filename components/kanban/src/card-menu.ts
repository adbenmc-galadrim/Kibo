import type { AgentExecution, DeliveryKind, Status, StatusId, TicketView } from "@kibo/schema";
import { type DeliverEntry, deliveryMenuActions } from "@kibo/sdk";
import type { MenuAction, MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { ExternalLink, Trash2 } from "lucide-react";
import type { fr } from "./fr";

export type CardMenuActions = {
  open(): void;
  move(statusId: StatusId): void;
  remove(): void;
  deliver(mode: DeliveryKind): void;
  copyDelivery(command: string): void;
};

export function cardMenuEntries(input: {
  ticket: TicketView;
  statuses: Status[];
  readOnly: boolean;
  deliver: DeliverEntry | null;
  execution: AgentExecution;
  texts: typeof fr;
  actions: CardMenuActions;
}): MenuEntry[] {
  const { ticket, statuses, readOnly, deliver, execution, texts, actions } = input;
  const open: MenuAction = { label: texts.open, icon: ExternalLink, onSelect: actions.open };
  if (readOnly) return [open];
  const targets: MenuAction[] = [...statuses]
    .sort((a, b) => a.order - b.order)
    .filter((s) => s.id !== ticket.statusId)
    .map((s) => ({
      label: s.id === "blocked" ? `${s.label}…` : s.label,
      onSelect: () => actions.move(s.id),
    }));
  return [
    open,
    ...deliveryMenuActions({
      execution,
      entry: deliver,
      ticket,
      deliver: actions.deliver,
      copy: actions.copyDelivery,
    }),
    { label: texts.moveTo, items: targets },
    { separator: true },
    { label: texts.remove, icon: Trash2, destructive: true, onSelect: actions.remove },
  ];
}
