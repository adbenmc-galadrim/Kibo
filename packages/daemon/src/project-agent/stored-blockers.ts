import type { ProjectFingerprint } from "@kibo/schema";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

const ticketsWithoutBlockers = (json: unknown): Set<string> => {
  const tickets = isRecord(json) ? json.tickets : undefined;
  if (!isRecord(tickets)) return new Set();
  return new Set(
    Object.entries(tickets)
      .filter(([, print]) => isRecord(print) && !("blockedBy" in print))
      .map(([id]) => id),
  );
};

export function withKnownBlockers(
  json: unknown,
  stored: ProjectFingerprint,
  current: ProjectFingerprint | undefined,
): ProjectFingerprint {
  const unknown = ticketsWithoutBlockers(json);
  if (unknown.size === 0 || current === undefined) return stored;
  const tickets = Object.fromEntries(
    Object.entries(stored.tickets).map(([id, print]) => [
      id,
      unknown.has(id) ? { ...print, blockedBy: [...(current.tickets[id]?.blockedBy ?? [])] } : print,
    ]),
  );
  return { ...stored, tickets };
}
