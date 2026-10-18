import { deliveryBrief, isInbox, type ProjectMeta, type TicketView } from "@kibo/schema";
import type { CopyTicket } from "@kibo/sdk";
import { frShell } from "../i18n/fr-shell";
import { normalize, type PaletteItem } from "./palette-items";

export type LocalAction = { kind: "projectAgent" } | { kind: "copyDelivery"; ticket: CopyTicket };

const localItem = (
  id: string,
  label: string,
  icon: PaletteItem["icon"],
  action: LocalAction,
): PaletteItem => ({
  id: `action:${id}`,
  group: "actions",
  label,
  keywords: normalize(label),
  detail: null,
  statusId: null,
  color: null,
  icon,
  run: { kind: "local", action },
  ticket: null,
});

export function trackingItems(
  project: ProjectMeta | undefined,
  ticket: TicketView | undefined,
): PaletteItem[] {
  if (!project || isInbox(project.id)) return [];
  const out = [
    localItem("projectAgent", frShell.palette.projectAgent, "projectAgent", { kind: "projectAgent" }),
  ];
  if (ticket?.key) {
    const command = deliveryBrief(ticket.key);
    const copy: CopyTicket = { key: ticket.key, startable: ticket.startable, waitingOn: ticket.waitingOn };
    out.push(
      localItem("copyDelivery", frShell.palette.copy(command), "copy", {
        kind: "copyDelivery",
        ticket: copy,
      }),
    );
  }
  return out;
}
