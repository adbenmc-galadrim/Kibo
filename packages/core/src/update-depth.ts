import {
  type Container,
  type ContainerID,
  isContainer,
  type LoroDoc,
  LoroList,
  LoroMap,
  LoroMovableList,
  LoroTree,
} from "loro-crdt";

export const MAX_TREE_DEPTH = 64;
export const MAX_CONTAINER_DEPTH = 32;

function changedContainers(before: LoroDoc, after: LoroDoc): ContainerID[] {
  const known = before.oplogVersion().toJSON();
  const changed = new Set<ContainerID>();
  for (const [peer, end] of after.oplogVersion().toJSON()) {
    const start = known.get(peer) ?? 0;
    if (end <= start) continue;
    for (const id of after.getChangedContainersIn({ peer, counter: start }, end - start)) changed.add(id);
  }
  return [...changed];
}

function boundedDepth(container: Container): number {
  let depth = 1;
  let parent = container.parent();
  while (parent && depth <= MAX_CONTAINER_DEPTH) {
    depth += 1;
    parent = parent.parent();
  }
  return depth;
}

function holdsContainer(container: Container): boolean {
  if (container instanceof LoroMap) return container.keys().some((key) => isContainer(container.get(key)));
  if (container instanceof LoroList || container instanceof LoroMovableList) {
    return container.toArray().some(isContainer);
  }
  if (container instanceof LoroTree) return container.getNodes({ withDeleted: true }).length > 0;
  return false;
}

function nestingTooDeep(container: Container): boolean {
  const depth = boundedDepth(container);
  return depth > MAX_CONTAINER_DEPTH || (depth === MAX_CONTAINER_DEPTH && holdsContainer(container));
}

function treeTooDeep(tree: LoroTree): boolean {
  const parents = new Map<string, string | undefined>();
  for (const node of tree.getNodes({ withDeleted: true })) parents.set(node.id, node.parent()?.id);
  const depths = new Map<string, number>();
  for (const id of parents.keys()) {
    const pending: string[] = [];
    let current: string | undefined = id;
    while (current !== undefined && parents.has(current) && !depths.has(current)) {
      pending.push(current);
      current = parents.get(current);
    }
    let depth = current === undefined ? 0 : (depths.get(current) ?? 0);
    for (const nodeId of pending.reverse()) {
      depth += 1;
      depths.set(nodeId, depth);
    }
    if (depth > MAX_TREE_DEPTH) return true;
  }
  return false;
}

export function depthViolation(before: LoroDoc, after: LoroDoc): string | null {
  for (const id of changedContainers(before, after)) {
    const container = after.getContainerById(id);
    if (!container) continue;
    if (nestingTooDeep(container)) return `containers are nested deeper than ${MAX_CONTAINER_DEPTH} levels`;
    if (container instanceof LoroTree && treeTooDeep(container)) {
      return `tree ${id} is deeper than ${MAX_TREE_DEPTH} levels`;
    }
  }
  return null;
}
