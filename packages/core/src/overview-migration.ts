import { formatRef, type Page, type ProjectCommand, type ProjectSnapshot, splitRef } from "@kibo/schema";

export const OVERVIEW_COMPONENT = "overview";
export const OVERVIEW_COMPONENT_REF = formatRef(OVERVIEW_COMPONENT, "1.0.0");
export const OVERVIEW_PAGE_TITLE = "Vue d'ensemble";

const emptyOverviewPage = (snapshot: ProjectSnapshot): Page | undefined => {
  const filled = new Set(snapshot.instances.map((i) => i.pageId));
  return snapshot.pages.find(
    (p) => p.kind === "view" && p.title === OVERVIEW_PAGE_TITLE && !filled.has(p.id),
  );
};

export function overviewMigrationCommands(snapshot: ProjectSnapshot): ProjectCommand[] {
  if (snapshot.instances.some((i) => splitRef(i.component).id === OVERVIEW_COMPONENT)) return [];
  const empty = emptyOverviewPage(snapshot);
  if (empty === undefined) return [{ method: "addPage", title: OVERVIEW_PAGE_TITLE, kind: "view" }];
  const fill: ProjectCommand = { method: "addInstance", pageId: empty.id, component: OVERVIEW_COMPONENT_REF };
  if (snapshot.pages[0]?.id === empty.id) return [fill];
  return [{ method: "movePage", pageId: empty.id, parentId: null, index: 0 }, fill];
}
