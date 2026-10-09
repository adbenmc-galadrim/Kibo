import { expect, test } from "bun:test";
import type { Page } from "@kibo/schema";
import { landingTarget } from "./project-landing";

const page = (id: string, title: string): Page => ({ id, title, kind: "view", parentId: null });
const project = { kind: "project", projectId: "p1" } as const;

test("a project lands on its « Tableau de bord » page", () => {
  const pages = [page("1@1", "Kanban"), page("2@1", "Tableau de bord")];
  expect(landingTarget(project, pages)).toEqual({ kind: "page", projectId: "p1", pageId: "2@1" });
});

test("a project without « Tableau de bord » lands on its first page", () => {
  const pages = [page("1@1", "Kanban"), page("2@1", "Notes")];
  expect(landingTarget(project, pages)).toEqual({ kind: "page", projectId: "p1", pageId: "1@1" });
});

test("a project without pages stays on the project target", () => {
  expect(landingTarget(project, [])).toBeNull();
});

test("a target with a precise page is never redirected", () => {
  const pages = [page("2@1", "Tableau de bord")];
  expect(landingTarget({ kind: "page", projectId: "p1", pageId: "1@1" }, pages)).toBeNull();
});
