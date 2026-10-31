import { expect, test } from "bun:test";
import type { ProjectCommand } from "@kibo/schema";
import { kiboProject } from "../../lib/fixtures";
import { planningMissing } from "./planning-missing";
import { addPlanningPage, PLANNING_REF } from "./planning-page";

const PAGE = { id: "p-plan", parentId: null, title: "Planning", kind: "view" as const };

test("a project whose instances do not include planning misses its Planning page", () => {
  const project = kiboProject();
  expect(planningMissing(project)).toBe(true);
  const withPlanning = {
    ...project,
    instances: [
      ...project.instances,
      {
        id: "i-plan",
        pageId: "p-plan",
        component: "planning@1.2.0",
        layout: { x: 0, y: 0, w: 12, h: 8 },
        config: {},
        componentHash: null,
      },
    ],
  };
  expect(planningMissing(withPlanning)).toBe(false);
});

test("adding the Planning page creates a view page then places the Planning component on it", async () => {
  const sent: ProjectCommand[] = [];
  const pageId = await addPlanningPage(async (command) => {
    sent.push(command);
    return command.method === "addPage" ? PAGE : null;
  });
  expect(sent).toEqual([
    { method: "addPage", title: "Planning", kind: "view" },
    { method: "addInstance", pageId: "p-plan", component: PLANNING_REF },
  ]);
  expect(PLANNING_REF).toBe("planning@1.0.0");
  expect(pageId).toBe("p-plan");
});
