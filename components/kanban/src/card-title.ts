import type { TicketView } from "@kibo/schema";
import { fr } from "./fr";

type FeatureRef = { keyLabel: string; shortKey: string | null };

const DEMO_TITLE = "démo client";

export function cardTitle(ticket: Pick<TicketView, "title">, feature: FeatureRef | null): string {
  if (feature === null || ticket.title.trim().toLowerCase() !== DEMO_TITLE) return ticket.title;
  return fr.demo(feature.shortKey ?? feature.keyLabel);
}
