import { deliveryBrief, type TicketView } from "@kibo/schema";
import { deliveryTexts } from "./fr-delivery";
import type { KiboSdk } from "./types";

type Toaster = Pick<KiboSdk, "toast">;
export type CopyTicket = Pick<TicketView, "key" | "startable" | "waitingOn">;

const waitingOf = (ticket: Pick<TicketView, "startable" | "waitingOn">): readonly string[] =>
  ticket.startable ? [] : ticket.waitingOn;

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard) throw new Error("clipboard unavailable");
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    console.warn("[kibo-sdk] clipboard write refused", e);
    return false;
  }
}

export async function copyCommand(
  sdk: Toaster,
  command: string,
  ticket: Pick<TicketView, "startable" | "waitingOn">,
): Promise<void> {
  if (!(await writeClipboard(command))) {
    sdk.toast(deliveryTexts.copyFailed);
    return;
  }
  sdk.toast(deliveryTexts.copied(waitingOf(ticket)));
}

export function copyDeliveryCommand(command: string): Promise<void>;
export function copyDeliveryCommand(sdk: Toaster, ticket: CopyTicket): Promise<void>;
export async function copyDeliveryCommand(target: string | Toaster, ticket?: CopyTicket): Promise<void> {
  if (typeof target === "string") {
    await writeClipboard(target);
    return;
  }
  if (ticket === undefined || ticket.key === null) {
    target.toast(deliveryTexts.copyFailed);
    return;
  }
  await copyCommand(target, deliveryBrief(ticket.key), ticket);
}
