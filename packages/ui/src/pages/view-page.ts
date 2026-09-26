import { type Page, type ProjectSnapshot, splitRef } from "@kibo/schema";

export function viewPageFor(
  project: Pick<ProjectSnapshot, "pages" | "instances">,
  componentId: string,
): Page | null {
  const shows = (p: Page) =>
    project.instances.some((i) => i.pageId === p.id && splitRef(i.component).id === componentId);
  return project.pages.find((p) => p.kind === "view" && shows(p)) ?? null;
}
