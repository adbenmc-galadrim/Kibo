import type { TicketView } from "@kibo/schema";
import { fr } from "./fr";

type StepFeature = Pick<TicketView, "keyLabel" | "shortKey">;

const DEMO_TITLE = "démo client";

export function stepTitle(ticket: Pick<TicketView, "title">, feature: StepFeature | null): string {
  if (feature === null || ticket.title.trim().toLowerCase() !== DEMO_TITLE) return ticket.title;
  return fr.demo(feature.shortKey ?? feature.keyLabel);
}
