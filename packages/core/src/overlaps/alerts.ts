import {
  DUPLICATION_LIMITS,
  type Overlap,
  type OverlapRole,
  overlapAlert,
  PEEK_WORK_TOOL,
} from "@kibo/schema";
import { othersLine } from "./section";

export type PendingAlert = {
  overlap: Overlap;
  role: OverlapRole;
  withRunName: string;
  withTicketKey: string;
};
export type PickedAlerts = { text: string | null; delivered: { overlapId: string; role: OverlapRole }[] };

const SEPARATOR = "\n\n";
const ROLE_ORDER: Record<OverlapRole, number> = { other: 0, owner: 1 };

const order = (a: PendingAlert, b: PendingAlert): number =>
  ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
  a.overlap.firstSeenAt - b.overlap.firstSeenAt ||
  a.overlap.id.localeCompare(b.overlap.id);

export function pickAlerts(pending: readonly PendingAlert[]): PickedAlerts {
  const sorted = [...pending].sort(order);
  const texts: string[] = [];
  const delivered: PickedAlerts["delivered"] = [];
  let size = 0;
  for (const alert of sorted) {
    if (texts.length >= DUPLICATION_LIMITS.alertsPerInjection) break;
    const text = overlapAlert(alert.role, alert.overlap.detail, alert.withRunName, alert.withTicketKey);
    const next = size + (texts.length > 0 ? SEPARATOR.length : 0) + text.length;
    if (texts.length > 0 && next > DUPLICATION_LIMITS.alertChars) break;
    texts.push(text);
    delivered.push({ overlapId: alert.overlap.id, role: alert.role });
    size = next;
  }
  if (texts.length === 0) return { text: null, delivered: [] };
  const rest = sorted.length - texts.length;
  const tail = rest > 0 ? [othersLine(rest, ` : \`${PEEK_WORK_TOOL}\``)] : [];
  return { text: [...texts, ...tail].join(SEPARATOR), delivered };
}
