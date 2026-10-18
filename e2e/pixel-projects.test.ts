import { expect, test } from "bun:test";
import { PIXEL_DAEMONS } from "./pixel-projects";
import { schemeOf } from "./pixel-screen";
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

test("the pixel daemons run the phase 27 specs, the Questions export first and alone", () => {
  for (const daemon of PIXEL_DAEMONS) {
    for (const screen of ["nouveau-projet", "kanban", "fiche-ticket", "vue-ensemble", "graphe"])
      expect(daemon.spec.test(`pixel-${screen}.spec.ts`)).toBe(true);
    expect(daemon.spec.test("pixel-questions.spec.ts")).toBe(false);
    const questions = `pixel-questions-${daemon.scheme}`;
    const project = (config.projects ?? []).find((p) => p.name === daemon.name);
    expect(project?.dependencies).toEqual([questions]);
    const first = (config.projects ?? []).find((p) => p.name === questions);
    expect(String(first?.testMatch)).toContain("pixel-questions");
    expect(first?.use?.baseURL).toBe(`http://127.0.0.1:${daemon.port}`);
  }
});

test("every light pixel project measures against the light mockups", () => {
  for (const project of pixelProjects)
    expect(schemeOf(project.name ?? "")).toBe(project.name?.endsWith("-light") === true ? "light" : "dark");
  expect(schemeOf("pixel-questions-light")).toBe("light");
});
