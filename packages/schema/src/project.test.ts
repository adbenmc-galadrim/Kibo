import { expect, test } from "bun:test";
import { ProjectMeta, ProjectPatch } from "./project";

test("a project patch carries at least one field and validates each", () => {
  expect(ProjectPatch.safeParse({}).success).toBe(false);
  expect(ProjectPatch.safeParse({ name: "  Kibo  " }).data).toEqual({ name: "Kibo" });
  expect(ProjectPatch.safeParse({ name: "   " }).success).toBe(false);
  expect(ProjectPatch.safeParse({ color: "orange" }).success).toBe(false);
  expect(ProjectPatch.safeParse({ folder: null }).data).toEqual({ folder: null });
  expect(ProjectPatch.safeParse({ folder: "" }).success).toBe(false);
  expect(ProjectPatch.safeParse({ key: "KIB" }).success).toBe(false);
});

test("project meta defaults worktree to null and the patch accepts it", () => {
  expect(
    ProjectMeta.parse({ id: "p", key: "AB", name: "n", folder: null, color: "#123456" }).worktree,
  ).toBeNull();
  expect(
    ProjectPatch.safeParse({ worktree: { baseRef: "origin/dev", pathTemplate: "../x-{slug}", setup: null } })
      .success,
  ).toBe(true);
  expect(ProjectPatch.safeParse({ worktree: null }).success).toBe(true);
});
