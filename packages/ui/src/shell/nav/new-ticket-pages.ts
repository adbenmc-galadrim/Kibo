import { type Instance, splitRef } from "@kibo/schema";

export const NEW_TICKET_PAGES = ["tickets", "overview"] as const;
const OWN_BUTTON: ReadonlySet<string> = new Set(["tickets"]);

export function newTicketSource(
  pageId: string,
  instances: readonly Pick<Instance, "pageId" | "component">[],
): "component" | "shell" | null {
  const held = instances.find((i) => i.pageId === pageId);
  if (!held) return null;
  const id = splitRef(held.component).id;
  if (!NEW_TICKET_PAGES.some((p) => p === id)) return null;
  return OWN_BUTTON.has(id) ? "component" : "shell";
}
