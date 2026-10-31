import { isOpen, type ProjectSnapshot, splitRef } from "@kibo/schema";

type Badged = Pick<ProjectSnapshot, "instances" | "sprints" | "questions">;

const count = (n: number): string | null => (n > 0 ? String(n) : null);

const BADGES: Record<string, (p: Badged) => string | null> = {
  planning: (p) => p.sprints.find((s) => s.state === "current")?.code ?? null,
  questions: (p) => count(p.questions.filter(isOpen).length),
};

export function pageBadge(pageId: string, project: Badged): string | null {
  const held = project.instances.find((i) => i.pageId === pageId);
  const badge = held ? BADGES[splitRef(held.component).id] : undefined;
  return badge ? badge(project) : null;
}
