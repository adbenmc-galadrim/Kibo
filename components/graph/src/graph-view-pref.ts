export type GraphViewKind = "features" | "prs";

export const viewKey = (instanceId: string): string => `kibo.graph.view.${instanceId}`;

export function readView(instanceId: string): GraphViewKind {
  try {
    return localStorage.getItem(viewKey(instanceId)) === "prs" ? "prs" : "features";
  } catch {
    return "features";
  }
}

export function writeView(instanceId: string, view: GraphViewKind): void {
  try {
    localStorage.setItem(viewKey(instanceId), view);
  } catch (e) {
    console.warn("[graph] view not saved", e);
  }
}
