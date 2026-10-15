import type { AssignPreview } from "@kibo/schema";
import { frAgentsPage } from "../i18n/fr-agents-page";
import { frAgentsSkills } from "../i18n/fr-agents-skills";
import { reasonText } from "./run-state-text";

const t = frAgentsSkills.assign;

export const refusalOf = (preview: AssignPreview | null): string | null => {
  if (preview?.reason?.kind === "ticket_busy") return frAgentsPage.assign.ticketBusy;
  return preview?.reason?.kind === "parent_ticket" ? frAgentsPage.assign.parentTicket : null;
};

export function queueText(preview: AssignPreview | null): string {
  if (!preview) return "-";
  if (preview.position === null) return refusalOf(preview) ?? t.startsNow;
  return t.entersQueue(reasonText(preview.reason), preview.position);
}

export function queueTone(preview: AssignPreview | null): string | undefined {
  if (!preview) return undefined;
  return refusalOf(preview) !== null ? "text-destructive" : "text-cyan-600 dark:text-cyan-400";
}
