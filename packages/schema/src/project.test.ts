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

test("project meta defaults storybook to null and the patch writes or clears it", () => {
  expect(
    ProjectMeta.parse({ id: "p", key: "AB", name: "n", folder: null, color: "#123456" }).storybook,
  ).toBeNull();
  expect(ProjectPatch.safeParse({ storybook: null }).success).toBe(true);
  expect(
    ProjectPatch.safeParse({ storybook: { origin: "https://sb.example.com", portEnv: "SB_PORT" } }).success,
  ).toBe(true);
  expect(
    ProjectPatch.safeParse({ storybook: { origin: "http://192.168.1.10:6006", portEnv: "SB_PORT" } }).success,
  ).toBe(false);
  expect(
    ProjectPatch.safeParse({ storybook: { origin: "http://localhost:6006", portEnv: "storybook-port" } })
      .success,
  ).toBe(false);
});
