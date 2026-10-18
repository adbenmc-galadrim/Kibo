import { Page, type ProjectCommand, type ProjectSetup, SETUP_PAGES, Sprint, sprintPlan } from "@kibo/schema";

export type SetupRunner = (command: ProjectCommand) => unknown;

function seedPage(run: SetupRunner, page: (typeof SETUP_PAGES)[number]): Page {
  const created = Page.parse(run({ method: "addPage", title: page.title, kind: "view" }));
  run({ method: "addInstance", pageId: created.id, component: page.component, config: page.config });
  return created;
}

export function setupProject(run: SetupRunner, setup: ProjectSetup): { pages: Page[]; sprints: Sprint[] } {
  const pages = SETUP_PAGES.map((page) => seedPage(run, page));
  const sprints = sprintPlan(setup).map((sprint) => Sprint.parse(run({ method: "createSprint", ...sprint })));
  return { pages, sprints };
}
