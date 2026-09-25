import { KiboError } from "@kibo/schema";
import type { LoroTree, LoroTreeNode, TreeID } from "loro-crdt";

export function getNode(tree: LoroTree, id: string): LoroTreeNode {
  const node = tree.has(id as TreeID) ? tree.getNodeByID(id as TreeID) : undefined;
  if (!node || node.isDeleted()) throw new KiboError("NOT_FOUND", `node ${id} not found`);
  return node;
}

export function isDescendant(tree: LoroTree, ancestorId: string, id: string): boolean {
  let current = getNode(tree, id).parent();
  while (current) {
    if (current.id === ancestorId) return true;
    current = current.parent();
  }
  return false;
}

export function moveNode(tree: LoroTree, id: string, parentId: string | null, index?: number): void {
  getNode(tree, id);
  if (parentId !== null) {
    getNode(tree, parentId);
    if (parentId === id || isDescendant(tree, id, parentId)) {
      throw new KiboError("TREE_CYCLE", `cannot move ${id} under its descendant ${parentId}`);
    }
  }
  tree.move(id as TreeID, (parentId ?? undefined) as TreeID | undefined, index);
}

export function walkDepthFirst(tree: LoroTree): LoroTreeNode[] {
  const out: LoroTreeNode[] = [];
  const visit = (n: LoroTreeNode) => {
    out.push(n);
    for (const c of n.children() ?? []) visit(c);
  };
  for (const r of tree.roots()) visit(r);
  return out;
}

export function subtreeIds(node: LoroTreeNode): string[] {
  return [node.id, ...(node.children() ?? []).flatMap(subtreeIds)];
}
