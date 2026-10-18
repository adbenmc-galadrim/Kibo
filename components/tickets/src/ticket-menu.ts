import type { AgentExecution, DeliveryKind, Status, StatusId, TicketView } from "@kibo/schema";
import { type DeliverEntry, deliveryMenuActions, type KiboSdk } from "@kibo/sdk";
import type { MenuAction, MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { CornerLeftUp, ExternalLink, Link2, Plus, Trash2 } from "lucide-react";
import type { fr } from "./fr";

export type TicketMenuActions = {
  open(): void;
  setStatus(statusId: StatusId): void;
  newSubTicket(): void;
  moveToRoot(): void;
  remove(): void;
  deliver(mode: DeliveryKind): void;
  attach(): void;
};

export function ticketMenuEntries(input: {
  ticket: TicketView;
  statuses: Status[];
  readOnly: boolean;
  deliver: DeliverEntry | null;
  execution: AgentExecution;
  texts: typeof fr;
  sdk: Pick<KiboSdk, "toast">;
  canAttach?: boolean;
  actions: TicketMenuActions;
}): MenuEntry[] {
  const { ticket, statuses, readOnly, deliver, execution, texts, sdk, actions } = input;
  const open: MenuAction = { label: texts.open, icon: ExternalLink, onSelect: actions.open };
  if (readOnly) return [open];
  const items: MenuAction[] = [...statuses]
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      label: s.id === "blocked" ? `${s.label}…` : s.label,
      disabled: s.id === ticket.statusId,
      onSelect: () => actions.setStatus(s.id),
    }));
  return [
    open,
    ...deliveryMenuActions({
      execution,
      entry: deliver,
      ticket,
      deliver: actions.deliver,
      sdk,
    }),
    { label: texts.status, items },
    { label: texts.newSub, icon: Plus, onSelect: actions.newSubTicket },
    ...(input.canAttach ? [{ label: texts.attach.action, icon: Link2, onSelect: actions.attach }] : []),
    {
      label: texts.moveToRoot,
      icon: CornerLeftUp,
      disabled: ticket.parentId === null,
      onSelect: actions.moveToRoot,
    },
    { separator: true },
    { label: texts.remove, icon: Trash2, destructive: true, onSelect: actions.remove },
  ];
}

export const descendantCount = (tickets: readonly TicketView[], id: string): number =>
  tickets.filter((t) => t.parentId === id).reduce((n, c) => n + 1 + descendantCount(tickets, c.id), 0);
