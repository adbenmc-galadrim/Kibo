import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import config from "./playwright.config";

const references = fileURLToPath(new URL("./references", import.meta.url));
const phonePixelProjects = (config.projects ?? []).filter((p) => p.name?.startsWith("phone-pixel-") === true);
const frozenTemplate = (name: string): string =>
  phonePixelProjects.find((p) => p.name === name)?.expect?.toHaveScreenshot?.pathTemplate ?? "";

test("the frozen phone references are kept per platform, since text rasterizes differently", () => {
  expect(phonePixelProjects.length).toBeGreaterThan(0);
  for (const project of phonePixelProjects)
    expect(frozenTemplate(project.name ?? "")).toContain("{platform}");
});

test("the CI platform has the dark phone reference it compares against", () => {
  expect(existsSync(`${references}/phone-graphe-dark-linux.png`)).toBe(true);
  for (const scheme of ["dark", "light"])
    expect(existsSync(`${references}/phone-graphe-${scheme}-darwin.png`)).toBe(true);
});
