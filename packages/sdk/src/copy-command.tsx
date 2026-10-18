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

export async function copyDeliveryCommand(sdk: Toaster, ticket: CopyTicket): Promise<void> {
  if (ticket.key === null) {
    sdk.toast(deliveryTexts.copyFailed);
    return;
  }
  await copyCommand(sdk, deliveryBrief(ticket.key), ticket);
}
