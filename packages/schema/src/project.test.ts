import { expect, test } from "bun:test";
import { EMPTY_DELIVERY } from "./delivery";
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

test("project meta defaults duplication to null and the patch writes or clears it", () => {
  expect(
    ProjectMeta.parse({ id: "p", key: "AB", name: "n", folder: null, color: "#123456" }).duplication,
  ).toBeNull();
  expect(ProjectPatch.safeParse({ duplication: null }).success).toBe(true);
  const settings = { enabled: false, minLines: 8, compareTests: false, ignore: [], genericExports: [] };
  expect(ProjectPatch.safeParse({ duplication: settings }).data).toEqual({ duplication: settings });
  expect(ProjectPatch.safeParse({ duplication: {} }).success).toBe(false);
});

test("project meta defaults delivery to null and the patch writes or clears it", () => {
  expect(
    ProjectMeta.parse({ id: "p", key: "AB", name: "n", folder: null, color: "#123456" }).delivery,
  ).toBeNull();
  expect(ProjectPatch.safeParse({ delivery: EMPTY_DELIVERY }).success).toBe(true);
  expect(ProjectPatch.safeParse({ delivery: null }).success).toBe(true);
  expect(ProjectPatch.safeParse({ delivery: {} }).success).toBe(false);
});

test("project meta has no tracking settings by default and the patch writes or clears them", () => {
  expect(
    ProjectMeta.parse({ id: "p", key: "AB", name: "n", folder: null, color: "#123456" }).tracking,
  ).toBeNull();
  expect(ProjectPatch.parse({ tracking: { openLimit: 3 } })).toEqual({ tracking: { openLimit: 3 } });
  expect(ProjectPatch.parse({ tracking: null })).toEqual({ tracking: null });
  expect(ProjectPatch.safeParse({ tracking: {} }).success).toBe(false);
  expect(ProjectPatch.safeParse({ tracking: { openLimit: 11 } }).success).toBe(false);
});
