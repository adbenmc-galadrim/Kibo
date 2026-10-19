import { expect, test } from "bun:test";
import { ComponentRef } from "./instance";
import { ProjectSetup, SETUP_PAGES } from "./project-setup";
import { RpcRequest } from "./rpc";

const SETUP: ProjectSetup = { sprintStart: "2026-10-19", sprintCount: 6, sprintWeeks: 1 };

test("a project setup names the first sprint, the count and the length", () => {
  expect(ProjectSetup.parse(SETUP)).toEqual(SETUP);
  expect(ProjectSetup.parse({ ...SETUP, sprintCount: 52, sprintWeeks: 2 }).sprintCount).toBe(52);
  expect(ProjectSetup.safeParse({ ...SETUP, sprintCount: 0 }).success).toBe(false);
  expect(ProjectSetup.safeParse({ ...SETUP, sprintCount: 53 }).success).toBe(false);
  expect(ProjectSetup.safeParse({ ...SETUP, sprintCount: 1.5 }).success).toBe(false);
  expect(ProjectSetup.safeParse({ ...SETUP, sprintWeeks: 3 }).success).toBe(false);
  expect(ProjectSetup.safeParse({ ...SETUP, sprintStart: "19/10/2026" }).success).toBe(false);
  expect(ProjectSetup.safeParse({ ...SETUP, folder: "/x" }).success).toBe(false);
});

test("a new project gets exactly five pages, in order", () => {
  expect(SETUP_PAGES.map((p) => p.title)).toEqual([
    "Vue d'ensemble",
    "Planning",
    "Kanban",
    "Graphe",
    "Questions",
  ]);
  expect(SETUP_PAGES.map((p) => p.component)).toEqual([
    "overview@1.0.0",
    "planning@1.0.0",
    "kanban@1.0.0",
    "graph@1.0.0",
    "questions@1.0.0",
  ]);
  for (const page of SETUP_PAGES) expect(ComponentRef.safeParse(page.component).success).toBe(true);
  expect(SETUP_PAGES.map((p) => p.config)).toEqual([{}, {}, { filter: "all" }, { filter: "all" }, {}]);
});

test("createProject takes an optional setup", () => {
  const base = { method: "createProject", name: "Silo", key: "SILO", folder: null, color: "#123456" };
  expect(RpcRequest.safeParse(base).success).toBe(true);
  expect(RpcRequest.safeParse({ ...base, setup: SETUP }).success).toBe(true);
  expect(RpcRequest.safeParse({ ...base, setup: { ...SETUP, sprintCount: 53 } }).success).toBe(false);
});
