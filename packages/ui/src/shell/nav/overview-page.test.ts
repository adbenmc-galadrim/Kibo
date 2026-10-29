import { expect, test } from "bun:test";
import type { ProjectCommand } from "@kibo/schema";
import { kiboProject } from "../../lib/fixtures";
import { overviewMissing } from "./overview-missing";
import { addOverviewPage, OVERVIEW_REF } from "./overview-page";

const PAGE = { id: "p-ov", parentId: null, title: "Vue d'ensemble", kind: "view" as const };

test("a project without an overview instance misses its Vue d'ensemble page", () => {
  const project = kiboProject();
  expect(overviewMissing(project)).toBe(true);
  const instance = {
    id: "i-ov",
    pageId: "p-ov",
    component: "overview@1.0.0",
    layout: { x: 0, y: 0, w: 12, h: 8 },
    config: {},
    componentHash: null,
  };
  expect(overviewMissing({ ...project, instances: [...project.instances, instance] })).toBe(false);
});

test("adding the page creates it, moves it first, then places the overview on it", async () => {
  const sent: ProjectCommand[] = [];
  const pageId = await addOverviewPage(async (command) => {
    sent.push(command);
    return command.method === "addPage" ? PAGE : null;
  });
  expect(sent).toEqual([
    { method: "addPage", title: "Vue d'ensemble", kind: "view" },
    { method: "movePage", pageId: "p-ov", parentId: null, index: 0 },
    { method: "addInstance", pageId: "p-ov", component: OVERVIEW_REF },
  ]);
  expect(OVERVIEW_REF).toBe("overview@1.0.0");
  expect(pageId).toBe("p-ov");
});
