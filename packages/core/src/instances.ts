import { compactLayouts, Instance, inGrid, KiboError, type Layout, layoutFor, overlaps } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { assertInstanceData, dropInstanceData, replaceInstanceData } from "./instance-data";
import { getNode } from "./tree";

const DEFAULT_LAYOUT: Layout = layoutFor("half", 0, 0);
const instances = (doc: LoroDoc) => doc.getMap("instances");

export function listInstances(doc: LoroDoc, pageId?: string): Instance[] {
  const all = Object.values(instances(doc).toJSON() as Record<string, unknown>).map((raw) =>
    Instance.parse(raw),
  );
  return pageId === undefined ? all : all.filter((i) => i.pageId === pageId);
}

export function getInstance(doc: LoroDoc, id: string): Instance {
  const raw = instances(doc).get(id);
  if (raw === undefined) throw new KiboError("NOT_FOUND", `instance ${id} not found`);
  return Instance.parse(raw);
}

function assertInGrid(layout: Layout): void {
  if (!inGrid(layout)) throw new KiboError("INVALID_INPUT", "layout is outside the grid");
}

const sameLayout = (a: Layout, b: Layout): boolean =>
  a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

function compactPage(doc: LoroDoc, pageId: string, first: readonly string[]): Instance[] {
  const page = listInstances(doc, pageId);
  const compacted = compactLayouts(
    page.map((i) => ({ id: i.id, layout: i.layout })),
    first,
  );
  return page.map((i) => {
    const layout = compacted.get(i.id) ?? i.layout;
    if (sameLayout(layout, i.layout)) return i;
    const next = { ...i, layout };
    instances(doc).set(i.id, next);
    return next;
  });
}

const belowAll = (doc: LoroDoc, pageId: string): Layout => ({
  ...DEFAULT_LAYOUT,
  y: Math.max(0, ...listInstances(doc, pageId).map((i) => i.layout.y + i.layout.h)),
});

export function addInstance(
  doc: LoroDoc,
  input: {
    pageId: string;
    component: string;
    layout?: Layout;
    config?: Record<string, unknown>;
    componentHash?: string | null;
  },
): Instance {
  const page = getNode(doc.getTree("pages"), input.pageId);
  if (page.data.get("kind") === "view" && listInstances(doc, input.pageId).length > 0) {
    throw new KiboError("INVALID_INPUT", "a view page holds a single component");
  }
  const parsed = Instance.safeParse({
    id: crypto.randomUUID(),
    pageId: input.pageId,
    component: input.component,
    layout: input.layout ?? belowAll(doc, input.pageId),
    config: input.config ?? {},
    componentHash: input.componentHash ?? null,
  });
  if (!parsed.success) throw new KiboError("INVALID_INPUT", parsed.error.message);
  if (input.layout !== undefined) assertInGrid(parsed.data.layout);
  instances(doc).set(parsed.data.id, parsed.data);
  compactPage(doc, input.pageId, input.layout === undefined ? [] : [parsed.data.id]);
  doc.commit();
  return getInstance(doc, parsed.data.id);
}

export function removeInstance(doc: LoroDoc, id: string): void {
  const { pageId } = getInstance(doc, id);
  instances(doc).delete(id);
  dropInstanceData(doc, id);
  compactPage(doc, pageId, []);
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
    componentHash?: string | null;
  },
): Instance {
  const current = getInstance(doc, input.instanceId);
  const parsed = Instance.safeParse({
    ...current,
    component: input.component,
    config: input.config,
    componentHash: input.componentHash ?? null,
  });
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

export function setInstanceLayout(doc: LoroDoc, instanceId: string, layout: Layout): Instance {
  const current = getInstance(doc, instanceId);
  const parsed = Instance.safeParse({ ...current, layout });
  if (!parsed.success) throw new KiboError("INVALID_INPUT", parsed.error.message);
  assertInGrid(parsed.data.layout);
  instances(doc).set(current.id, parsed.data);
  compactPage(doc, current.pageId, [current.id]);
  doc.commit();
  return getInstance(doc, current.id);
}

export function setPageLayout(
  doc: LoroDoc,
  pageId: string,
  layouts: readonly { instanceId: string; layout: Layout }[],
): Instance[] {
  getNode(doc.getTree("pages"), pageId);
  if (layouts.length === 0) throw new KiboError("INVALID_INPUT", "setPageLayout needs at least one layout");
  const twice = layouts.find((l, i) => layouts.findIndex((o) => o.instanceId === l.instanceId) !== i);
  if (twice !== undefined) {
    throw new KiboError("INVALID_INPUT", `instance ${twice.instanceId} is listed more than once`);
  }
  const listed = layouts.map(({ instanceId, layout }) => {
    const current = getInstance(doc, instanceId);
    if (current.pageId !== pageId) {
      throw new KiboError("INVALID_INPUT", `instance ${instanceId} is not on page ${pageId}`);
    }
    assertInGrid(layout);
    return { ...current, layout };
  });
  for (const [i, a] of listed.entries()) {
    for (const b of listed.slice(i + 1)) {
      if (overlaps(a.layout, b.layout)) {
        throw new KiboError("INVALID_INPUT", `layouts of ${a.id} and ${b.id} overlap`);
      }
    }
  }
  for (const instance of listed) instances(doc).set(instance.id, instance);
  const pinned = listed
    .map((i) => ({ id: i.id, layout: i.layout }))
    .sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x || (a.id < b.id ? -1 : 1))
    .map((i) => i.id);
  const result = compactPage(doc, pageId, pinned);
  doc.commit();
  return result;
}
