import type { Project } from "@playwright/test";
import {
  DESIGN_REFERENCES,
  PIXEL_KIT_REFERENCES,
  PIXEL_SCREENSHOT,
  REFERENCES_TEMPLATE,
  SILO_MAQUETTES,
} from "./pixel-settings";

const PIXEL_DARK_PORT = 4477;
const PIXEL_LIGHT_PORT = 4478;
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
