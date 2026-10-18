import { isFeature, type ProjectSnapshot, type TicketView } from "@kibo/schema";

export type FeatureDependency = {
  id: string;
  label: string;
  title: string;
  delivered: boolean;
  sprint: string | null;
};
export type FeatureDependencies = { waits: FeatureDependency[]; unblocks: FeatureDependency[] };

type Project = Pick<ProjectSnapshot, "tickets" | "links" | "sprints">;

function rootOf(byId: ReadonlyMap<string, TicketView>, id: string): TicketView | null {
  const seen = new Set<string>();
  let current = byId.get(id);
  while (current?.parentId && !seen.has(current.id)) {
    seen.add(current.id);
    current = byId.get(current.parentId);
  }
  return current ?? null;
}

const dependency = (project: Project, root: TicketView): FeatureDependency => {
  const sprint = project.sprints.find((s) => s.id === root.sprintId);
  return {
    id: root.id,
    label: root.shortKey ?? root.keyLabel,
    title: root.title,
    delivered: root.feature ? root.feature.status === "delivered" : root.statusId === "done",
    sprint: sprint?.code ?? null,
  };
};

export function featureDependencies(project: Project, featureId: string): FeatureDependencies {
  const byId = new Map(project.tickets.map((t) => [t.id, t]));
  const waits = new Map<string, TicketView>();
  const unblocks = new Map<string, TicketView>();
  for (const link of project.links) {
    if (link.type !== "blocks") continue;
    const from = rootOf(byId, link.from);
    const to = rootOf(byId, link.to);
    if (!from || !to || from.id === to.id) continue;
    if (to.id === featureId) waits.set(from.id, from);
    if (from.id === featureId) unblocks.set(to.id, to);
  }
  const ordered = (m: Map<string, TicketView>) =>
    project.tickets.filter((t) => m.has(t.id)).map((t) => dependency(project, t));
  return { waits: ordered(waits), unblocks: ordered(unblocks) };
}

export function dependencyCandidates(project: Project, featureId: string): FeatureDependency[] {
  const { waits, unblocks } = featureDependencies(project, featureId);
  const taken = new Set([featureId, ...waits.map((d) => d.id), ...unblocks.map((d) => d.id)]);
  return project.tickets.filter((t) => isFeature(t) && !taken.has(t.id)).map((t) => dependency(project, t));
}
