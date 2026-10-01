import { expect, test } from "bun:test";
import { permissionModeLabel } from "./permission-mode";

test("each permission mode reads in plain French", () => {
  expect(permissionModeLabel("plan")).toBe("Lecture seule (plan)");
  expect(permissionModeLabel("acceptEdits")).toBe("Modifications acceptées");
  expect(permissionModeLabel("default")).toBe("Demande à chaque action");
});
