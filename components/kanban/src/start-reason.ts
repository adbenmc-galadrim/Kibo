import type { StartReason } from "@kibo/schema";
import { fr } from "./fr";

export function startReasonText(reason: StartReason | null): string | null {
  if (reason === null) return null;
  if (reason.kind === "sprint") return fr.reason.sprint(reason.code);
  if (reason.kind === "unplanned") return fr.reason.unplanned;
  if (reason.kind === "limit") return fr.reason.limit;
  return null;
}
