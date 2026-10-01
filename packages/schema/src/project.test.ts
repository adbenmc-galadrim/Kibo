import { expect, test } from "bun:test";
import { ProjectPatch } from "./project";

test("a project patch carries at least one field and validates each", () => {
  expect(ProjectPatch.safeParse({}).success).toBe(false);
  expect(ProjectPatch.safeParse({ name: "  Kibo  " }).data).toEqual({ name: "Kibo" });
  expect(ProjectPatch.safeParse({ name: "   " }).success).toBe(false);
  expect(ProjectPatch.safeParse({ color: "orange" }).success).toBe(false);
  expect(ProjectPatch.safeParse({ folder: null }).data).toEqual({ folder: null });
  expect(ProjectPatch.safeParse({ folder: "" }).success).toBe(false);
  expect(ProjectPatch.safeParse({ key: "KIB" }).success).toBe(false);
});
