import type { PlaywrightTestConfig, Project } from "@playwright/test";
import { DESIGN_REFERENCES, PIXEL_SCREENSHOT, REFERENCES_TEMPLATE } from "./pixel-settings";

type Scheme = "dark" | "light";
type PhoneServer = {
  name: string;
  scheme: Scheme;
  daemonPort: number;
  serverPort: number;
  macPort: number;
  controlPort: number;
};

export const PHONE_SETUP_CODE = "e2e-setup-code-0123456789";

export const PHONE_SERVERS: readonly PhoneServer[] = [
  {
    name: "phone-dark",
    scheme: "dark",
    daemonPort: 4463,
    serverPort: 4465,
    macPort: 4467,
    controlPort: 4469,
  },
  {
    name: "phone-light",
    scheme: "light",
    daemonPort: 4464,
    serverPort: 4466,
    macPort: 4468,
    controlPort: 4470,
  },
];

export const phoneOrigin = (serverPort: number): string => `http://localhost:${serverPort}`;

export function phoneServerOf(projectName: string): PhoneServer {
  const scheme: Scheme = projectName.endsWith("-light") ? "light" : "dark";
  const server = PHONE_SERVERS.find((s) => s.scheme === scheme);
  if (server === undefined) throw new Error(`no phone server for ${projectName}`);
  return server;
}

const PHONE_REFERENCES = "{testDir}/references/{arg}-{platform}{ext}";
const PHONE_SPECS = /\/phone-[a-z]+\.spec\.ts$/;
const PHONE_PIXEL_SPEC = /pixel-phone-graphe\.spec\.ts$/;
const PHONE_SCREEN = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } as const;
const PIXEL_SCALE = 2;
const JOURNEY_SCALE = 3;

const useOf = (server: PhoneServer, deviceScaleFactor: number): Project["use"] => ({
  browserName: "chromium",
  colorScheme: server.scheme,
  baseURL: phoneOrigin(server.serverPort),
  ...PHONE_SCREEN,
  deviceScaleFactor,
});

export const phoneProjects = (schemes: readonly Scheme[]): Project[] =>
  PHONE_SERVERS.filter((s) => schemes.includes(s.scheme)).flatMap((server) => {
    const pixel = `phone-pixel-${server.scheme}`;
    return [
      {
        name: pixel,
        testMatch: PHONE_PIXEL_SPEC,
        workers: 1,
        use: useOf(server, PIXEL_SCALE),
        snapshotPathTemplate: REFERENCES_TEMPLATE,
        metadata: { pixelSources: DESIGN_REFERENCES },
        expect: { toHaveScreenshot: { ...PIXEL_SCREENSHOT, pathTemplate: PHONE_REFERENCES } },
      },
      {
        name: server.name,
        testMatch: PHONE_SPECS,
        dependencies: [pixel],
        workers: 1,
        use: useOf(server, JOURNEY_SCALE),
      },
    ];
  });

type WebServer = Exclude<NonNullable<PlaywrightTestConfig["webServer"]>, unknown[]>;

export const phoneWebServers = (schemes: readonly Scheme[]): WebServer[] =>
  PHONE_SERVERS.filter((s) => schemes.includes(s.scheme)).map((server) => ({
    command: `bun phone-serve.ts ${server.name}`,
    url: `http://127.0.0.1:${server.controlPort}/ready`,
    reuseExistingServer: false,
    timeout: 180_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
  }));
