import { DeliveryStep, EMPTY_PROGRESS, ExternalRef, Hold, KiboError, TicketProgress } from "@kibo/schema";
import type { LoroTreeNode } from "loro-crdt";
import type { ZodType, ZodTypeDef } from "zod";

const RefList = ExternalRef.array();

export function readExternalRefs(node: LoroTreeNode): ExternalRef[] {
  const raw = node.data.get("externalRefs");
  if (raw === undefined || raw === null) return [];
  const parsed = RefList.safeParse(raw);
  if (!parsed.success) throw new KiboError("STORE_CORRUPT", `invalid external refs on ${node.id}`);
  return parsed.data;
}

function readField<T>(
  node: LoroTreeNode,
  field: string,
  schema: ZodType<T, ZodTypeDef, unknown>,
  empty: T,
  what: string,
): T {
  const raw = node.data.get(field);
  if (raw === undefined || raw === null) return empty;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new KiboError("STORE_CORRUPT", `invalid ${what} on ${node.id}`);
  return parsed.data;
}

export const readProgress = (node: LoroTreeNode): TicketProgress =>
  readField(node, "agentProgress", TicketProgress, EMPTY_PROGRESS, "agent progress");
export const readDelivery = (node: LoroTreeNode): DeliveryStep | null =>
  readField(node, "delivery", DeliveryStep.nullable(), null, "delivery step");
export const readHold = (node: LoroTreeNode): Hold | null =>
  readField(node, "hold", Hold.nullable(), null, "hold");
