import type { Status, StatusId, TicketView } from "@kibo/schema";
import type { MenuAction, MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { ExternalLink, Trash2 } from "lucide-react";
import type { fr } from "./fr";

export type CardMenuActions = { open(): void; move(statusId: StatusId): void; remove(): void };

export function cardMenuEntries(input: {
  ticket: TicketView;
  statuses: Status[];
  readOnly: boolean;
  texts: typeof fr;
  actions: CardMenuActions;
}): MenuEntry[] {
  const { ticket, statuses, readOnly, texts, actions } = input;
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
    { label: texts.moveTo, items: targets },
    { separator: true },
    { label: texts.remove, icon: Trash2, destructive: true, onSelect: actions.remove },
  ];
}
