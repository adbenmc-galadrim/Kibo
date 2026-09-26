import type { LoroDoc } from "loro-crdt";

export type UpdateVerdict = { ok: true } | { ok: false; reason: string };

const SERVER_META_FIELDS = ["ticketSeq", "keyAllocator", "members"] as const;
const FROZEN_META_FIELDS = ["id", "key", "folder"] as const;
const ABSENT = "absent";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value instanceof Object) {
    const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function metaField(doc: LoroDoc, field: string): string {
  const meta: Record<string, unknown> = doc.getMap("meta").toJSON();
  return field in meta ? canonical(meta[field]) : ABSENT;
}

function ticketKeys(doc: LoroDoc): Map<string, string> {
  return new Map(
    doc
      .getTree("tickets")
      .getNodes({ withDeleted: true })
      .map((node) => {
        const data: Record<string, unknown> = node.data.toJSON();
        return [node.id, canonical(data.key)];
      }),
  );
}

const UNSET = canonical(null);

function keyViolation(before: LoroDoc, after: LoroDoc): string | null {
  const previous = ticketKeys(before);
  for (const [ticketId, key] of ticketKeys(after)) {
    const assigned = previous.get(ticketId) ?? UNSET;
    if (assigned !== UNSET && key !== assigned) {
      return `ticket ${ticketId}: assigned key ${assigned} cannot change`;
    }
    if (assigned === UNSET && key !== UNSET) {
      return `ticket ${ticketId}: key ${key} can only be assigned by the server`;
    }
  }
  return null;
}

export function validateProjectUpdate(before: LoroDoc, after: LoroDoc): UpdateVerdict {
  for (const field of SERVER_META_FIELDS) {
    if (metaField(before, field) !== metaField(after, field)) {
      return { ok: false, reason: `meta.${field} is written by the server only` };
    }
  }
  for (const field of FROZEN_META_FIELDS) {
    if (metaField(before, field) !== metaField(after, field)) {
      return { ok: false, reason: `meta.${field} is frozen once the project is shared` };
    }
  }
  const violation = keyViolation(before, after);
  return violation === null ? { ok: true } : { ok: false, reason: violation };
}
