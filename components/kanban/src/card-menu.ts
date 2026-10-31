import type { Status, StatusId, TicketView } from "@kibo/schema";
import { deliveryMenuActions, type KiboSdk } from "@kibo/sdk";
import type { MenuAction, MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { ExternalLink, Trash2 } from "lucide-react";
import type { fr } from "./fr";

export type CardMenuActions = {
  open(): void;
  move(statusId: StatusId): void;
  remove(): void;
};

export function cardMenuEntries(input: {
  ticket: TicketView;
  statuses: Status[];
  texts: typeof fr;
  sdk: Pick<KiboSdk, "toast">;
  actions: CardMenuActions;
}): MenuEntry[] {
  const { ticket, statuses, texts, sdk, actions } = input;
  const open: MenuAction = { label: texts.open, icon: ExternalLink, onSelect: actions.open };
  const targets: MenuAction[] = [...statuses]
    .sort((a, b) => a.order - b.order)
    .filter((s) => s.id !== ticket.statusId)
    .map((s) => ({
      label: s.id === "blocked" ? `${s.label}…` : s.label,
      onSelect: () => actions.move(s.id),
    }));
  return [
    open,
    ...deliveryMenuActions({ ticket, sdk }),
    { label: texts.moveTo, items: targets },
    { separator: true },
    { label: texts.remove, icon: Trash2, destructive: true, onSelect: actions.remove },
  ];
}
