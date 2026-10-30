import type { Guideline, GuidelineScope } from "@kibo/schema";

export type ChainTarget = { projectId: string; domainId: string | null };
export type ContextFile = { path: string; content: string };

const ORDER: GuidelineScope[] = ["workspace", "project", "domain"];

function applies(g: Guideline, target: ChainTarget): boolean {
  switch (g.owner.scope) {
    case "workspace":
      return true;
    case "project":
      return g.owner.projectId === target.projectId;
    case "domain":
      return g.owner.domainId === target.domainId;
  }
}

export function guidelineChain(all: Guideline[], target: ChainTarget): Guideline[] {
  return all
    .filter((g) => applies(g, target))
    .sort(
      (a, b) => ORDER.indexOf(a.owner.scope) - ORDER.indexOf(b.owner.scope) || a.path.localeCompare(b.path),
    );
}
