import type { Project } from "@playwright/test";
import {
  DESIGN_REFERENCES,
  EMIS_MAQUETTES,
  PIXEL_KIT_REFERENCES,
  PIXEL_SCREENSHOT,
  REFERENCES_TEMPLATE,
} from "./pixel-settings";

const PIXEL_DARK_PORT = 4477;
const PIXEL_LIGHT_PORT = 4478;

export const PIXEL_DAEMONS = [
  {
    name: "pixel-dark",
    scheme: "dark",
    port: PIXEL_DARK_PORT,
    spec: /pixel-(planning|fonctionnalite|tickets|coque|vue-ensemble|graphe)\.spec\.ts/,
    scenario: EMIS_MAQUETTES,
    integrations: true,
  },
  {
    name: "pixel-light",
    scheme: "light",
    port: PIXEL_LIGHT_PORT,
    spec: /pixel-(planning|fonctionnalite|tickets|coque|vue-ensemble|graphe)\.spec\.ts/,
    scenario: EMIS_MAQUETTES,
    integrations: true,
  },
] as const;

const screenshotOptions = (sources: string): Partial<Project> => ({
  snapshotPathTemplate: REFERENCES_TEMPLATE,
  metadata: { pixelSources: sources },
  expect: { toHaveScreenshot: PIXEL_SCREENSHOT },
});

export const pixelProjectOptions = (name: string): Partial<Project> =>
  PIXEL_DAEMONS.some((d) => d.name === name) ? screenshotOptions(DESIGN_REFERENCES) : {};

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
      { name: planning, testMatch: TRACKING_SPEC, dependencies: [d.name], use },
      { name: `traces-${d.scheme}`, testMatch: TRACES_SPEC, dependencies: [planning], use },
    ];
  });
