import { expect, test } from "bun:test";
import { ALL_DAEMONS } from "./daemons";
import {
  APERCU_DAEMONS,
  ATTENTE_DAEMONS,
  GRAPHE_DAEMONS,
  PIXEL_DAEMONS,
  PRS_DAEMONS,
  SCENARIO_DAEMONS,
  T3_DAEMONS,
} from "./pixel-projects";
import { schemeOf } from "./pixel-screen";
import {
  COMPARED_REFERENCES,
  DESIGN_REFERENCES,
  SILO_APERCU,
  SILO_ATTENTE,
  SILO_GRAPHE,
  SILO_PRS,
} from "./pixel-settings";
import config from "./playwright.config";
import {
  fakeBranchStorybookPort,
  fakeFigmaPort,
  fakeGithubPort,
  fakeMcpPort,
  fakePenpotPort,
  fakeStorybookPort,
  seedReadyPort,
} from "./token";

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

test("the stacked pull requests run on their own daemons 4485 and 4486, pixel first then the journey", () => {
  expect(PRS_DAEMONS.map((d) => [d.name, d.scheme, d.port, d.scenario, d.integrations])).toEqual([
    ["prs-dark", "dark", 4485, SILO_PRS, true],
    ["prs-light", "light", 4486, SILO_PRS, true],
  ]);
  const servers = Array.isArray(config.webServer) ? config.webServer : [];
  for (const daemon of PRS_DAEMONS) {
    const base = `http://127.0.0.1:${daemon.port}`;
    const pixel = projectNamed(`prs-pixel-${daemon.scheme}`);
    expect(pixel?.use?.baseURL).toBe(base);
    expect(pixel?.use?.colorScheme).toBe(daemon.scheme);
    expect(pixel?.snapshotPathTemplate?.startsWith(`${COMPARED_REFERENCES}/`)).toBe(true);
    expect(pixel?.metadata?.pixelSources).toBe(DESIGN_REFERENCES);
    expect(pixel?.dependencies ?? []).toEqual([]);
    const journey = projectNamed(`prs-${daemon.scheme}`);
    expect(journey?.use?.baseURL).toBe(base);
    expect(journey?.dependencies).toEqual([`prs-pixel-${daemon.scheme}`]);
    const pixelMatch = pixel?.testMatch;
    const journeyMatch = journey?.testMatch;
    if (!(pixelMatch instanceof RegExp) || !(journeyMatch instanceof RegExp))
      throw new Error("the stacked projects match their specs by a pattern");
    expect(pixelMatch.test("/e2e/pixel-prs.spec.ts")).toBe(true);
    expect(pixelMatch.test("/e2e/prs.spec.ts")).toBe(false);
    expect(journeyMatch.test("/e2e/prs.spec.ts")).toBe(true);
    expect(journeyMatch.test("/e2e/pixel-prs.spec.ts")).toBe(false);
    const server = servers.find((w) => w.command.startsWith(`bun serve.ts ${daemon.port} `));
    expect(server?.command).toBe(`bun serve.ts ${daemon.port} ${SILO_PRS} --integrations`);
    expect(server?.url).toBe(`http://127.0.0.1:${seedReadyPort(daemon.port)}/`);
    expect(server?.timeout).toBe(120_000);
  }
});

test("no other project picks the stacked pull request specs", () => {
  const others = (config.projects ?? []).filter((p) => !p.name?.startsWith("prs-"));
  for (const project of others) {
    const match = project.testMatch;
    if (!(match instanceof RegExp)) continue;
    expect(match.test("/e2e/pixel-prs.spec.ts")).toBe(false);
    expect(match.test("/e2e/prs.spec.ts")).toBe(false);
  }
});

type PixelOnlyDaemon = { scheme: "dark" | "light"; port: number };

function expectPixelOnly(prefix: string, daemon: PixelOnlyDaemon, command: string): void {
  const pixel = projectNamed(`${prefix}-pixel-${daemon.scheme}`);
  expect(pixel?.use?.baseURL).toBe(`http://127.0.0.1:${daemon.port}`);
  expect(pixel?.use?.colorScheme).toBe(daemon.scheme);
  expect(pixel?.snapshotPathTemplate?.startsWith(`${COMPARED_REFERENCES}/`)).toBe(true);
  expect(pixel?.metadata?.pixelSources).toBe(DESIGN_REFERENCES);
  expect(pixel?.dependencies ?? []).toEqual([]);
  expect(projectNamed(`${prefix}-${daemon.scheme}`)).toBeUndefined();
  const servers = Array.isArray(config.webServer) ? config.webServer : [];
  const server = servers.find((w) => w.command.startsWith(`bun serve.ts ${daemon.port} `));
  expect(server?.command).toBe(command);
  expect(server?.url).toBe(`http://127.0.0.1:${seedReadyPort(daemon.port)}/`);
  expect(server?.timeout).toBe(120_000);
}

const owners = (spec: string): string[] =>
  (config.projects ?? [])
    .filter((p) => p.testMatch instanceof RegExp && p.testMatch.test(spec))
    .map((p) => p.name ?? "");

test("the full-screen mockup runs on its own daemons 4487 and 4488, with GitHub and Figma faked together", () => {
  expect(APERCU_DAEMONS.map((d) => [d.name, d.scheme, d.port, d.scenario, d.integrations, d.design])).toEqual(
    [
      ["apercu-dark", "dark", 4487, SILO_APERCU, true, true],
      ["apercu-light", "light", 4488, SILO_APERCU, true, true],
    ],
  );
  for (const daemon of APERCU_DAEMONS)
    expectPixelOnly("apercu", daemon, `bun serve.ts ${daemon.port} ${SILO_APERCU} --integrations --design`);
});

test("only the full-screen pixel projects pick its spec", () => {
  for (const project of config.projects ?? []) {
    const match = project.testMatch;
    if (!(match instanceof RegExp)) continue;
    const owner = project.name?.startsWith("apercu-pixel-") === true;
    expect(match.test("/e2e/pixel-apercu.spec.ts")).toBe(owner);
    if (owner) expect(match.test("/e2e/design.spec.ts")).toBe(false);
  }
});

test("the Graphe on hold runs on its own daemons 4489 and 4490, pixel only", () => {
  expect(GRAPHE_DAEMONS.map((d) => [d.name, d.scheme, d.port, d.scenario, d.integrations])).toEqual([
    ["graphe-dark", "dark", 4489, SILO_GRAPHE, true],
    ["graphe-light", "light", 4490, SILO_GRAPHE, true],
  ]);
  for (const daemon of GRAPHE_DAEMONS)
    expectPixelOnly("graphe", daemon, `bun serve.ts ${daemon.port} ${SILO_GRAPHE} --integrations`);
});

test("only the Graphe on hold pixel projects pick its spec, and they pick no other", () => {
  expect(owners("/e2e/pixel-graphe-attente.spec.ts")).toEqual(["graphe-pixel-dark", "graphe-pixel-light"]);
  expect(owners("/e2e/pixel-graphe.spec.ts")).toEqual(["pixel-dark", "pixel-light"]);
  expect(owners("/e2e/pixel-attente.spec.ts")).toEqual(["attente-pixel-dark", "attente-pixel-light"]);
  expect(owners("/e2e/attente.spec.ts")).toEqual(["attente-dark", "attente-light"]);
});

test("the widened agent is measured by the pixel daemons alone", () => {
  expect(owners("/e2e/pixel-agent.spec.ts")).toEqual(["pixel-dark", "pixel-light"]);
});

test("the agent conversation runs on the Suivi daemons after their journeys, a new agent closing their batch", () => {
  expect(owners("/e2e/agent-conversation.spec.ts")).toEqual([
    "agent-conversation-dark",
    "agent-conversation-light",
  ]);
  for (const scheme of ["dark", "light"] as const) {
    const journey = projectNamed(`agent-conversation-${scheme}`);
    const suivi = projectNamed(`suivi-${scheme}`);
    expect(journey?.use?.baseURL).toBe(suivi?.use?.baseURL);
    expect(journey?.use?.colorScheme).toBe(scheme);
    expect(journey?.dependencies).toEqual([`suivi-${scheme}`]);
  }
});

const DERIVED = [
  fakeGithubPort,
  fakeMcpPort,
  fakeFigmaPort,
  fakePenpotPort,
  fakeStorybookPort,
  fakeBranchStorybookPort,
  seedReadyPort,
];

test("every scenario daemon is in the port check", () => {
  expect(SCENARIO_DAEMONS).toEqual([
    ...ATTENTE_DAEMONS,
    ...PRS_DAEMONS,
    ...APERCU_DAEMONS,
    ...GRAPHE_DAEMONS,
    ...T3_DAEMONS,
  ]);
});

test("no port of a daemon or of its fake services is taken twice", () => {
  const daemons = [...ALL_DAEMONS, ...SCENARIO_DAEMONS].map((d) => d.port);
  const derived = daemons.flatMap((port) => DERIVED.map((of) => of(port)));
  const all = [...daemons, ...derived];
  expect(new Set(all).size).toBe(all.length);
});
