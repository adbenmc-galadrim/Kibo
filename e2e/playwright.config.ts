import { defineConfig, type PlaywrightTestConfig, type Project } from "@playwright/test";
import { ALL_DAEMONS, agentConversationProjects, serveCommand } from "./daemons";
import {
  pixelKitProject,
  pixelProjectOptions,
  SCENARIO_DAEMONS,
  scenarioProjectsOf,
  trackingProjects,
} from "./pixel-projects";
import { isSiloScenario } from "./pixel-settings";
import { seedReadyPort } from "./token";

const THEMES = ["dark", "light"] as const;
type Theme = (typeof THEMES)[number];

function onlyTheme(): Theme | null {
  const wanted = process.env.KIBO_E2E_THEME;
  if (wanted === undefined || wanted === "") return null;
  const theme = THEMES.find((t) => t === wanted);
  if (theme === undefined) throw new Error(`KIBO_E2E_THEME must be one of ${THEMES.join(", ")}`);
  return theme;
}

const only = onlyTheme();
const inTheme = (scheme: Theme): boolean => only === null || only === scheme;

const daemons = ALL_DAEMONS.filter((d) => inTheme(d.scheme));
const servers = [...daemons, ...SCENARIO_DAEMONS.filter((d) => inTheme(d.scheme))];

type WebServer = Exclude<NonNullable<PlaywrightTestConfig["webServer"]>, unknown[]>;

export default defineConfig({
  testDir: ".",
  timeout: 30_000,
  updateSnapshots: "none",
  use: { trace: "retain-on-failure" },
  projects: [
    ...daemons.map(
      (d): Project => ({
        name: d.name,
        testMatch: d.spec,
        use: { browserName: "chromium", colorScheme: d.scheme, baseURL: `http://127.0.0.1:${d.port}` },
        ...pixelProjectOptions(d.name),
      }),
    ),
    ...(inTheme("dark") ? [pixelKitProject()] : []),
    ...trackingProjects(daemons.map((d) => d.name)),
    ...agentConversationProjects(daemons.map((d) => d.name)),
    ...THEMES.filter(inTheme).flatMap(scenarioProjectsOf),
  ],
  webServer: servers.map(
    (d): WebServer => ({
      command: serveCommand(d),
      url: `http://127.0.0.1:${isSiloScenario(d.scenario) ? seedReadyPort(d.port) : d.port}/`,
      reuseExistingServer: false,
      timeout: isSiloScenario(d.scenario) ? 120_000 : 60_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
    }),
  ),
});
