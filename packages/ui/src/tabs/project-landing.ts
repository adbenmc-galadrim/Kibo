import type { Page, TabTarget } from "@kibo/schema";
import { fr } from "../i18n/fr";

export function landingTarget(target: TabTarget | null, pages: readonly Page[]): TabTarget | null {
  if (target?.kind !== "project") return null;
  const page = pages.find((p) => p.title === fr.newPage.dashboard) ?? pages[0];
  return page ? { kind: "page", projectId: target.projectId, pageId: page.id } : null;
}
