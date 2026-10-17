import { expect, test } from "bun:test";
import { COMPARED_REFERENCES, DESIGN_REFERENCES } from "./pixel-settings";
import config from "./playwright.config";

const pixelProjects = (config.projects ?? []).filter((p) => p.name?.startsWith("pixel-") === true);

test("every pixel project compares against the painted copies, never against design/", () => {
  expect(pixelProjects.length).toBeGreaterThan(0);
  for (const project of pixelProjects) {
    const template = project.snapshotPathTemplate ?? "";
    expect(template.startsWith(`${COMPARED_REFERENCES}/`)).toBe(true);
    expect(template.includes(DESIGN_REFERENCES)).toBe(false);
  }
});
