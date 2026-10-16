import type { Project } from "@playwright/test";
import {
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
    spec: /pixel\.spec\.ts/,
    scenario: EMIS_MAQUETTES,
  },
  {
    name: "pixel-light",
    scheme: "light",
    port: PIXEL_LIGHT_PORT,
    spec: /pixel\.spec\.ts/,
    scenario: EMIS_MAQUETTES,
  },
] as const;

const screenshotOptions = (template: string): Partial<Project> => ({
  snapshotPathTemplate: template,
  expect: { toHaveScreenshot: PIXEL_SCREENSHOT },
});

export const pixelProjectOptions = (name: string): Partial<Project> =>
  PIXEL_DAEMONS.some((d) => d.name === name) ? screenshotOptions(REFERENCES_TEMPLATE) : {};

export const pixelKitProject = (): Project => ({
  name: "pixel-kit",
  testMatch: /pixel-kit\.spec\.ts/,
  use: { browserName: "chromium", colorScheme: "dark", baseURL: `http://127.0.0.1:${PIXEL_DARK_PORT}` },
  ...screenshotOptions(`${PIXEL_KIT_REFERENCES}/{arg}{ext}`),
});
