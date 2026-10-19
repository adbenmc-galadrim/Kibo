import { expect, test } from "bun:test";
import { ATTENTE_DAEMONS, PIXEL_DAEMONS } from "./pixel-projects";
import { schemeOf } from "./pixel-screen";
import { COMPARED_REFERENCES, DESIGN_REFERENCES, SILO_ATTENTE } from "./pixel-settings";
import config from "./playwright.config";
import { seedReadyPort } from "./token";

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

const projectNamed = (name: string) => (config.projects ?? []).find((p) => p.name === name);

test("the on-hold scenario runs on its own daemons 4481 and 4482, pixel first then the journey", () => {
  expect(ATTENTE_DAEMONS.map((d) => [d.name, d.scheme, d.port, d.scenario])).toEqual([
    ["attente-dark", "dark", 4481, SILO_ATTENTE],
    ["attente-light", "light", 4482, SILO_ATTENTE],
  ]);
  for (const daemon of ATTENTE_DAEMONS) {
    const base = `http://127.0.0.1:${daemon.port}`;
    const pixel = projectNamed(`attente-pixel-${daemon.scheme}`);
    expect(pixel?.use?.baseURL).toBe(base);
    expect(pixel?.use?.colorScheme).toBe(daemon.scheme);
    expect(pixel?.snapshotPathTemplate?.startsWith(`${COMPARED_REFERENCES}/`)).toBe(true);
    expect(pixel?.metadata?.pixelSources).toBe(DESIGN_REFERENCES);
    expect(pixel?.dependencies ?? []).toEqual([]);
    const journey = projectNamed(`attente-${daemon.scheme}`);
    expect(journey?.use?.baseURL).toBe(base);
    expect(journey?.dependencies).toEqual([`attente-pixel-${daemon.scheme}`]);
    const pixelMatch = pixel?.testMatch;
    const journeyMatch = journey?.testMatch;
    if (!(pixelMatch instanceof RegExp) || !(journeyMatch instanceof RegExp))
      throw new Error("the on-hold projects match their specs by a pattern");
    expect(pixelMatch.test("/e2e/pixel-attente.spec.ts")).toBe(true);
    expect(pixelMatch.test("/e2e/attente.spec.ts")).toBe(false);
    expect(journeyMatch.test("/e2e/attente.spec.ts")).toBe(true);
    expect(journeyMatch.test("/e2e/pixel-attente.spec.ts")).toBe(false);
  }
});

test("no other project picks the on-hold specs", () => {
  const others = (config.projects ?? []).filter((p) => !p.name?.startsWith("attente-"));
  for (const project of others) {
    const match = project.testMatch;
    if (!(match instanceof RegExp)) continue;
    expect(match.test("/e2e/pixel-attente.spec.ts")).toBe(false);
    expect(match.test("/e2e/attente.spec.ts")).toBe(false);
  }
});

test("the on-hold daemons are served and seeded like the Silo pixel daemons", () => {
  const servers = Array.isArray(config.webServer) ? config.webServer : [];
  for (const daemon of ATTENTE_DAEMONS) {
    const server = servers.find((w) => w.command.startsWith(`bun serve.ts ${daemon.port} `));
    expect(server?.command).toBe(`bun serve.ts ${daemon.port} ${SILO_ATTENTE} --integrations`);
    expect(server?.url).toBe(`http://127.0.0.1:${seedReadyPort(daemon.port)}/`);
    expect(server?.timeout).toBe(120_000);
  }
});
