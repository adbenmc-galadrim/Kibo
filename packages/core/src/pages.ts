import { KiboError, type Page } from "@kibo/schema";
import type { LoroDoc, LoroTreeNode, TreeID } from "loro-crdt";
import { removeInstancesOfPages } from "./instances";
import { getNode, moveNode, subtreeIds, walkDepthFirst } from "./tree";

const toPage = (n: LoroTreeNode): Page => ({
  id: n.id,
  title: n.data.get("title") as string,
  kind: n.data.get("kind") as Page["kind"],
  parentId: n.parent()?.id ?? null,
});

const cleanTitle = (title: string): string => {
  const t = title.trim();
  if (!t) throw new KiboError("INVALID_INPUT", "page title is empty");
  return t;
};

export function addPage(
  doc: LoroDoc,
  input: { title: string; kind: Page["kind"]; parentId?: string | null },
): Page {
  const tree = doc.getTree("pages");
  const parent = input.parentId ? getNode(tree, input.parentId) : undefined;
  const node = parent ? parent.createNode() : tree.createNode();
  node.data.set("title", cleanTitle(input.title));
  node.data.set("kind", input.kind);
  doc.commit();
  return toPage(node);
}

export function listPages(doc: LoroDoc): Page[] {
  return walkDepthFirst(doc.getTree("pages")).map(toPage);
}

export function renamePage(doc: LoroDoc, id: string, title: string): void {
  getNode(doc.getTree("pages"), id).data.set("title", cleanTitle(title));
  doc.commit();
}

export function movePage(doc: LoroDoc, id: string, parentId: string | null, index?: number): void {
  moveNode(doc.getTree("pages"), id, parentId, index);
  doc.commit();
}

export function deletePage(doc: LoroDoc, id: string): string[] {
  const tree = doc.getTree("pages");
  const ids = subtreeIds(getNode(tree, id));
  tree.delete(id as TreeID);
  removeInstancesOfPages(doc, ids);
  return ids;
}
