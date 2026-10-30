import { deliveryBrief, FINAL_STATUSES, type TicketView, updateDeliveryBrief } from "@kibo/schema";
import { Copy } from "lucide-react";
import { copyCommand } from "./copy-command";
import { deliveryTexts } from "./fr-delivery";
import type { KiboSdk } from "./types";
import type { MenuAction } from "./ui/menu-entries";

export type DeliveryMenu = {
  sdk: Pick<KiboSdk, "toast">;
  ticket: Pick<TicketView, "key" | "statusId" | "startable" | "waitingOn">;
};

export function deliveryMenuActions(menu: DeliveryMenu): MenuAction[] {
  const command = deliveryCommand(menu.ticket);
  if (command === null) return [];
  return [
    {
      label: deliveryTexts.copy(command),
      icon: Copy,
      onSelect: () => void copyCommand(menu.sdk, command, menu.ticket),
    },
  ];
}

export function deliveryCommand({ key, statusId }: Pick<TicketView, "key" | "statusId">): string | null {
  if (key === null) return null;
  return FINAL_STATUSES.includes(statusId) ? updateDeliveryBrief(key) : deliveryBrief(key);
}

export { type CopyTicket, copyCommand, copyDeliveryCommand } from "./copy-command";
