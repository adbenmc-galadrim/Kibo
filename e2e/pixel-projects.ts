import type { Project } from "@playwright/test";
import {
  DESIGN_REFERENCES,
  PIXEL_KIT_REFERENCES,
  PIXEL_SCREENSHOT,
  REFERENCES_TEMPLATE,
  SILO_ATTENTE,
  SILO_MAQUETTES,
  SILO_PRS,
} from "./pixel-settings";

const PIXEL_DARK_PORT = 4477;
const PIXEL_LIGHT_PORT = 4478;
const ATTENTE_DARK_PORT = 4481;
const ATTENTE_LIGHT_PORT = 4482;
const PRS_DARK_PORT = 4485;
const PRS_LIGHT_PORT = 4486;
const PRS_PIXEL_SPEC = /pixel-prs\.spec\.ts$/;
const PRS_SPEC = /\/prs\.spec\.ts$/;
const ATTENTE_PIXEL_SPEC = /pixel-attente\.spec\.ts$/;
const ATTENTE_SPEC = /\/attente\.spec\.ts$/;
const PIXEL_SPECS =
  /pixel-(planning|fonctionnalite|tickets|coque|vue-ensemble|graphe|nouveau-projet|kanban|fiche-ticket)\.spec\.ts/;
const QUESTIONS_SPEC = /pixel-questions\.spec\.ts/;
const questionsProjectOf = (scheme: string): string => `pixel-questions-${scheme}`;

export const PIXEL_DAEMONS = [
  {
    name: "pixel-dark",
    scheme: "dark",
    port: PIXEL_DARK_PORT,
    spec: PIXEL_SPECS,
    scenario: SILO_MAQUETTES,
    integrations: true,
  },
  {
    name: "pixel-light",
    scheme: "light",
    port: PIXEL_LIGHT_PORT,
    spec: PIXEL_SPECS,
    scenario: SILO_MAQUETTES,
    integrations: true,
  },
] as const;

export const ATTENTE_DAEMONS = [
  {
    name: "attente-dark",
    scheme: "dark",
    port: ATTENTE_DARK_PORT,
    scenario: SILO_ATTENTE,
    integrations: true,
  },
  {
    name: "attente-light",
    scheme: "light",
    port: ATTENTE_LIGHT_PORT,
    scenario: SILO_ATTENTE,
    integrations: true,
  },
] as const;

export const PRS_DAEMONS = [
  { name: "prs-dark", scheme: "dark", port: PRS_DARK_PORT, scenario: SILO_PRS, integrations: true },
  { name: "prs-light", scheme: "light", port: PRS_LIGHT_PORT, scenario: SILO_PRS, integrations: true },
] as const;

export const SCENARIO_DAEMONS = [...ATTENTE_DAEMONS, ...PRS_DAEMONS] as const;

const screenshotOptions = (sources: string): Partial<Project> => ({
  snapshotPathTemplate: REFERENCES_TEMPLATE,
  metadata: { pixelSources: sources },
  expect: { toHaveScreenshot: PIXEL_SCREENSHOT },
});

export function pixelProjectOptions(name: string): Partial<Project> {
  const daemon = PIXEL_DAEMONS.find((d) => d.name === name);
  if (daemon === undefined) return {};
  return { ...screenshotOptions(DESIGN_REFERENCES), dependencies: [questionsProjectOf(daemon.scheme)] };
}

export const pixelKitProject = (): Project => ({
  name: "pixel-kit",
  testMatch: /pixel-kit\.spec\.ts/,
  use: { browserName: "chromium", colorScheme: "dark", baseURL: `http://127.0.0.1:${PIXEL_DARK_PORT}` },
  ...screenshotOptions(PIXEL_KIT_REFERENCES),
});

const TRACKING_SPEC = /\/planning\.spec\.ts$/;
const TRACES_SPEC = /\/traces\.spec\.ts$/;

export const trackingProjects = (daemons: readonly string[]): Project[] =>
  PIXEL_DAEMONS.filter((d) => daemons.includes(d.name)).flatMap((d) => {
    const use: Project["use"] = {
      browserName: "chromium",
      colorScheme: d.scheme,
      baseURL: `http://127.0.0.1:${d.port}`,
    };
    const planning = `planning-${d.scheme}`;
    return [
      {
        name: questionsProjectOf(d.scheme),
        testMatch: QUESTIONS_SPEC,
        use,
        ...screenshotOptions(DESIGN_REFERENCES),
      },
      { name: planning, testMatch: TRACKING_SPEC, dependencies: [d.name], use },
      { name: `traces-${d.scheme}`, testMatch: TRACES_SPEC, dependencies: [planning], use },
    ];
  });

type Scheme = "dark" | "light";
type ScenarioDaemon = { scheme: Scheme; port: number };
type ScenarioSpecs = { prefix: string; pixel: RegExp; journey: RegExp };

function scenarioProjects(
  daemons: readonly ScenarioDaemon[],
  specs: ScenarioSpecs,
  scheme: Scheme,
): Project[] {
  const daemon = daemons.find((d) => d.scheme === scheme);
  if (daemon === undefined) return [];
  const use: Project["use"] = {
    browserName: "chromium",
    colorScheme: scheme,
    baseURL: `http://127.0.0.1:${daemon.port}`,
  };
  const pixel = `${specs.prefix}-pixel-${scheme}`;
  return [
    { name: pixel, testMatch: specs.pixel, use, ...screenshotOptions(DESIGN_REFERENCES) },
    { name: `${specs.prefix}-${scheme}`, testMatch: specs.journey, dependencies: [pixel], use },
  ];
}

export const attenteProjects = (scheme: Scheme): Project[] =>
  scenarioProjects(
    ATTENTE_DAEMONS,
    { prefix: "attente", pixel: ATTENTE_PIXEL_SPEC, journey: ATTENTE_SPEC },
    scheme,
  );

export const prsProjects = (scheme: Scheme): Project[] =>
  scenarioProjects(PRS_DAEMONS, { prefix: "prs", pixel: PRS_PIXEL_SPEC, journey: PRS_SPEC }, scheme);

export const scenarioProjectsOf = (scheme: Scheme): Project[] => [
  ...attenteProjects(scheme),
  ...prsProjects(scheme),
];
