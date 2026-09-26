import { Instance, KiboError, type Layout } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { assertInstanceData, dropInstanceData, replaceInstanceData } from "./instance-data";
import { getNode } from "./tree";

const DEFAULT_LAYOUT: Layout = { x: 0, y: 0, w: 12, h: 6 };
const instances = (doc: LoroDoc) => doc.getMap("instances");

export function listInstances(doc: LoroDoc, pageId?: string): Instance[] {
  const all = Object.values(instances(doc).toJSON() as Record<string, Instance>);
  return pageId === undefined ? all : all.filter((i) => i.pageId === pageId);
}

export function getInstance(doc: LoroDoc, id: string): Instance {
  const raw = instances(doc).get(id);
  if (raw === undefined) throw new KiboError("NOT_FOUND", `instance ${id} not found`);
  return Instance.parse(raw);
}

export function addInstance(
  doc: LoroDoc,
  input: { pageId: string; component: string; layout?: Layout; config?: Record<string, unknown> },
): Instance {
  const page = getNode(doc.getTree("pages"), input.pageId);
  if (page.data.get("kind") === "view" && listInstances(doc, input.pageId).length > 0) {
    throw new KiboError("INVALID_INPUT", "a view page holds a single component");
  }
  const parsed = Instance.safeParse({
    id: crypto.randomUUID(),
    pageId: input.pageId,
    component: input.component,
    layout: input.layout ?? DEFAULT_LAYOUT,
    config: input.config ?? {},
  });
  if (!parsed.success) throw new KiboError("INVALID_INPUT", parsed.error.message);
  instances(doc).set(parsed.data.id, parsed.data);
  doc.commit();
  return parsed.data;
}

export function removeInstance(doc: LoroDoc, id: string): void {
  getInstance(doc, id);
  instances(doc).delete(id);
  dropInstanceData(doc, id);
  doc.commit();
}

export function removeInstancesOfPages(doc: LoroDoc, pageIds: string[]): void {
  const gone = new Set(pageIds);
  for (const i of listInstances(doc)) {
    if (!gone.has(i.pageId)) continue;
    instances(doc).delete(i.id);
    dropInstanceData(doc, i.id);
  }
  doc.commit();
}

export function setInstanceComponent(
  doc: LoroDoc,
  input: {
    instanceId: string;
    component: string;
    config: Record<string, unknown>;
    data: Record<string, unknown> | null;
  },
): Instance {
  const current = getInstance(doc, input.instanceId);
  const parsed = Instance.safeParse({ ...current, component: input.component, config: input.config });
  if (!parsed.success) throw new KiboError("INVALID_INPUT", parsed.error.message);
  if (input.data !== null) assertInstanceData(input.data);
  instances(doc).set(current.id, parsed.data);
  if (input.data !== null) replaceInstanceData(doc, current.id, input.data);
  doc.commit();
  return parsed.data;
}

export function setInstanceConfig(
  doc: LoroDoc,
  instanceId: string,
  config: Record<string, unknown>,
): Instance {
  const parsed = Instance.safeParse({ ...getInstance(doc, instanceId), config });
  if (!parsed.success) throw new KiboError("INVALID_INPUT", parsed.error.message);
  instances(doc).set(parsed.data.id, parsed.data);
  doc.commit();
  return parsed.data;
}
