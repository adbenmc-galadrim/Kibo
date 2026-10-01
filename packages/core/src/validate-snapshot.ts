import { formatTicketKey, ProjectMeta } from "@kibo/schema";
import { isContainer, type LoroDoc, type LoroMap } from "loro-crdt";
import { projectDepthViolation } from "./update-depth";
import { bindingsSnapshotViolation } from "./validate-bindings";
import { instancesSnapshotViolation } from "./validate-instances";
import type { UpdateVerdict } from "./validate-update";

const SHAPED_META_FIELDS = {
  name: ProjectMeta.shape.name,
  color: ProjectMeta.shape.color,
  key: ProjectMeta.shape.key,
};
const ALLOWED_META_FIELDS = new Set(["id", "ticketSeq", "keyAllocator", ...Object.keys(SHAPED_META_FIELDS)]);

function localOnlyViolation(meta: LoroMap): string | null {
  if (meta.get("folder") !== undefined) return "meta.folder is a local path and cannot be shared";
  if (meta.get("members") !== undefined) return "meta.members is written by the server only";
  const allocator = meta.get("keyAllocator");
  if (allocator !== undefined && allocator !== "local")
    return "meta.keyAllocator must be local before sharing";
  return null;
}

function metaFieldsViolation(meta: LoroMap, projectId: string): string | null {
  for (const field of meta.keys()) {
    if (!ALLOWED_META_FIELDS.has(field)) return `meta.${field} is not a project field`;
    if (isContainer(meta.get(field))) return `meta.${field} must be a plain value`;
  }
  for (const [field, schema] of Object.entries(SHAPED_META_FIELDS)) {
    if (!schema.safeParse(meta.get(field)).success) return `meta.${field} has an invalid value`;
  }
  if (meta.get("id") !== projectId) return `meta.id must be ${projectId}`;
  const seq = meta.get("ticketSeq");
  if (typeof seq !== "number" || !Number.isInteger(seq) || seq < 0)
    return "meta.ticketSeq is not a sequence number";
  return null;
}

function allocatedKey(meta: LoroMap): (key: unknown) => boolean {
  const projectKey = String(meta.get("key"));
  const seq = Number(meta.get("ticketSeq"));
  return (key) => {
    if (typeof key !== "string" || !key.startsWith(`${projectKey}-`)) return false;
    const n = Number(key.slice(projectKey.length + 1));
    return Number.isInteger(n) && n >= 1 && n <= seq && formatTicketKey(projectKey, n) === key;
  };
}

function ticketKeysViolation(doc: LoroDoc, meta: LoroMap): string | null {
  const isAllocated = allocatedKey(meta);
  const seen = new Set<string>();
  for (const node of doc.getTree("tickets").getNodes({ withDeleted: true })) {
    const key = node.data.get("key");
    if (key === undefined || key === null) {
      if (node.isDeleted()) continue;
      return `ticket ${node.id} has no key`;
    }
    if (typeof key !== "string" || !isAllocated(key))
      return `ticket ${node.id}: key ${String(key)} is not allocated`;
    if (seen.has(key)) return `ticket key ${key} is used twice`;
    seen.add(key);
  }
  return null;
}

export function validateSharedSnapshot(doc: LoroDoc, projectId: string, ownerId: string): UpdateVerdict {
  const meta = doc.getMap("meta");
  const reason =
    projectDepthViolation(doc) ??
    localOnlyViolation(meta) ??
    metaFieldsViolation(meta, projectId) ??
    ticketKeysViolation(doc, meta) ??
    instancesSnapshotViolation(doc) ??
    bindingsSnapshotViolation(doc.getMap("bindings"), ownerId);
  return reason === null ? { ok: true } : { ok: false, reason };
}
