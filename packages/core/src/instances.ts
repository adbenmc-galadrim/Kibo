import { Instance, KiboError, type Layout } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { getNode } from "./tree";

const DEFAULT_LAYOUT: Layout = { x: 0, y: 0, w: 12, h: 6 };
const instances = (doc: LoroDoc) => doc.getMap("instances");

export function listInstances(doc: LoroDoc, pageId?: string): Instance[] {
  const all = Object.values(instances(doc).toJSON() as Record<string, Instance>);
  return pageId === undefined ? all : all.filter((i) => i.pageId === pageId);
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
  if (instances(doc).get(id) === undefined) throw new KiboError("NOT_FOUND", `instance ${id} not found`);
  instances(doc).delete(id);
  doc.commit();
}

export function removeInstancesOfPages(doc: LoroDoc, pageIds: string[]): void {
  const gone = new Set(pageIds);
  for (const i of listInstances(doc)) if (gone.has(i.pageId)) instances(doc).delete(i.id);
  doc.commit();
}
