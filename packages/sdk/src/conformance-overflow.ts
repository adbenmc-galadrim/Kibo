export type Rect = { left: number; top: number; right: number; bottom: number };
export type BoxNode = { path: string; rect: Rect; clips: boolean; painted: boolean; children: BoxNode[] };
export type OverflowViolation = { container: string; child: string; by: number };

export function collectBoxes(root: Element): BoxNode {
  const walk = (el: Element, path: string): BoxNode => {
    const style = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const transparent = (c: string) => c === "transparent" || c === "rgba(0, 0, 0, 0)" || c === "";
    const border = ["top", "right", "bottom", "left"].some(
      (side) => Number.parseFloat(style.getPropertyValue(`border-${side}-width`)) > 0,
    );
    return {
      path,
      rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
      clips: [style.overflow, style.overflowX, style.overflowY].some((v) => v !== "" && v !== "visible"),
      painted: !transparent(style.backgroundColor) || border,
      children: Array.from(el.children).map((child, index) =>
        walk(child, `${path}>${child.tagName.toLowerCase()}:nth-child(${index + 1})`),
      ),
    };
  };
  return walk(root, root.tagName.toLowerCase());
}

const area = (r: Rect): number => Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top);

const overflowBy = (child: Rect, parent: Rect): number =>
  Math.max(
    parent.left - child.left,
    parent.top - child.top,
    child.right - parent.right,
    child.bottom - parent.bottom,
  );

const judged = (node: BoxNode): BoxNode[] =>
  node.children.flatMap((c) => (c.clips ? [c] : [c, ...judged(c)]));

export function overflowViolations(root: BoxNode, tolerance = 1): OverflowViolation[] {
  const out: OverflowViolation[] = [];
  const visit = (node: BoxNode) => {
    if (node.painted && !node.clips) {
      for (const child of judged(node)) {
        const by = overflowBy(child.rect, node.rect);
        if (area(child.rect) > 0 && by > tolerance) {
          out.push({ container: node.path, child: child.path, by: Math.round(by) });
        }
      }
    }
    for (const child of node.children) visit(child);
  };
  visit(root);
  return out;
}
