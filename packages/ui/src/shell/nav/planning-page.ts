import { formatRef, Page, type ProjectCommand } from "@kibo/schema";
import { PLANNING_ID } from "./planning-missing";

const PLANNING_TITLE = "Planning";
export const PLANNING_REF = formatRef(PLANNING_ID, "1.0.0");

export async function addPlanningPage(run: (command: ProjectCommand) => Promise<unknown>): Promise<string> {
  const page = Page.parse(await run({ method: "addPage", title: PLANNING_TITLE, kind: "view" }));
  await run({ method: "addInstance", pageId: page.id, component: PLANNING_REF });
  return page.id;
}
