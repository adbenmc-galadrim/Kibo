import { formatRef, Page, type ProjectCommand } from "@kibo/schema";
import { OVERVIEW_ID } from "./overview-missing";

const OVERVIEW_TITLE = "Vue d'ensemble";
export const OVERVIEW_REF = formatRef(OVERVIEW_ID, "1.0.0");

export async function addOverviewPage(run: (command: ProjectCommand) => Promise<unknown>): Promise<string> {
  const page = Page.parse(await run({ method: "addPage", title: OVERVIEW_TITLE, kind: "view" }));
  await run({ method: "movePage", pageId: page.id, parentId: null, index: 0 });
  await run({ method: "addInstance", pageId: page.id, component: OVERVIEW_REF });
  return page.id;
}
