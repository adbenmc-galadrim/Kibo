import { ProjectMeta } from "@kibo/schema";
import { isContainer, type LoroDoc, LoroMap, type LoroTree } from "loro-crdt";

export type UpdateVerdict = { ok: true } | { ok: false; reason: string };

const FROZEN_META_FIELDS = ["ticketSeq", "keyAllocator", "id", "key", "folder"];
const EDITABLE_META_FIELDS = { name: ProjectMeta.shape.name, color: ProjectMeta.shape.color };
const KNOWN_META_FIELDS = new Set([...FROZEN_META_FIELDS, "members", ...Object.keys(EDITABLE_META_FIELDS)]);

const isPrimitive = (value: unknown): boolean =>
  value === undefined || value === null || ["string", "number", "boolean"].includes(typeof value);

function sameSurface(before: unknown, after: unknown): boolean {
  if (isContainer(before) || isContainer(after)) {
    return isContainer(before) && isContainer(after) && before.id === after.id;
  }
  return isPrimitive(before) && isPrimitive(after) && before === after;
}

function frozenViolation(before: LoroMap, after: LoroMap): string | null {
  for (const field of FROZEN_META_FIELDS) {
    if (!sameSurface(before.get(field), after.get(field))) {
      return `meta.${field} is written by the server only or frozen once shared`;
    }
  }
  return null;
}

function editableViolation(before: LoroMap, after: LoroMap): string | null {
  for (const [field, schema] of Object.entries(EDITABLE_META_FIELDS)) {
    const value = after.get(field);
    if (sameSurface(before.get(field), value)) continue;
    if (isContainer(value) || !schema.safeParse(value).success) return `meta.${field} has an invalid value`;
  }
  for (const field of after.keys()) {
    if (KNOWN_META_FIELDS.has(field) || sameSurface(before.get(field), after.get(field))) continue;
    return `meta.${field} is not a project field`;
  }
  return null;
}

function memberName(entry: unknown): string | null {
  if (isContainer(entry) || !(entry instanceof Object) || Object.keys(entry).length !== 1) return null;
  return "name" in entry && typeof entry.name === "string" ? entry.name : null;
}

function membersViolation(before: LoroMap, after: LoroMap): string | null {
  const previous = before.get("members");
  const current = after.get("members");
  if (previous === undefined && current === undefined) return null;
  const reason = "meta.members is written by the server only";
  const sameDirectory =
    previous instanceof LoroMap && current instanceof LoroMap && previous.id === current.id;
  if (!sameDirectory) return reason;
  const userIds = current.keys();
  if (userIds.length !== previous.keys().length) return reason;
  for (const userId of userIds) {
    const name = memberName(current.get(userId));
    if (name === null || name !== memberName(previous.get(userId))) return reason;
  }
  return null;
}

function assignedKeys(tree: LoroTree): Map<string, unknown> {
  return new Map(tree.getNodes({ withDeleted: true }).map((node) => [node.id, node.data.get("key")]));
}

const isUnset = (key: unknown): boolean => key === null || key === undefined;

function keyViolation(before: LoroDoc, after: LoroDoc): string | null {
  const previous = assignedKeys(before.getTree("tickets"));
  for (const [ticketId, key] of assignedKeys(after.getTree("tickets"))) {
    const assigned = previous.get(ticketId);
    if (isContainer(key)) return `ticket ${ticketId}: key must be a plain value`;
    if (typeof assigned === "string" && key !== assigned) {
      return `ticket ${ticketId}: assigned key ${assigned} cannot change`;
    }
    if (isUnset(assigned) && !isUnset(key)) {
      return `ticket ${ticketId}: keys are assigned by the server only`;
    }
  }
  return null;
}

export function validateProjectUpdate(before: LoroDoc, after: LoroDoc): UpdateVerdict {
  const metaBefore = before.getMap("meta");
  const metaAfter = after.getMap("meta");
  const reason =
    frozenViolation(metaBefore, metaAfter) ??
    membersViolation(metaBefore, metaAfter) ??
    editableViolation(metaBefore, metaAfter) ??
    keyViolation(before, after);
  return reason === null ? { ok: true } : { ok: false, reason };
}
