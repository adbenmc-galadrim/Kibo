import type { StartReason } from "@kibo/schema";
import { fr } from "./fr";

export function startReasonText(
  reason: StartReason | null,
  waitingOn: readonly string[] = [],
): string | null {
  if (reason === null) return null;
  if (reason.kind === "sprint") return fr.reason.sprint(reason.code);
  if (reason.kind === "unplanned") return fr.reason.unplanned;
  if (reason.kind === "limit") return fr.reason.limit(reason.count, reason.limit);
  if (reason.kind === "dependency") {
    const unnamed = reason.keys.filter((key) => !waitingOn.includes(key));
    return unnamed.length === 0 ? null : fr.waitingOn(unnamed.join(", "));
  }
  return null;
}
