import { expect, test } from "bun:test";
import { windowTitle } from "./window-title";

test("the window title follows the active tab, Kibo alone on the home", () => {
  expect(windowTitle(null)).toBe("Kibo");
  expect(windowTitle("Kibo · Kanban")).toBe("Kibo · Kanban — Kibo");
  expect(windowTitle("Kibo · KIB-12")).toBe("Kibo · KIB-12 — Kibo");
  expect(windowTitle("")).toBe("Kibo");
});
