import { defineConfig, type PlaywrightTestConfig, type Project } from "@playwright/test";
import { ALL_DAEMONS } from "./daemons";
import {
  ATTENTE_DAEMONS,
  attenteProjects,
  pixelKitProject,
  pixelProjectOptions,
  trackingProjects,
} from "./pixel-projects";
import { isSiloScenario } from "./pixel-settings";
import { SYNC_PORTS } from "./sync-fixture";
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
const servers = [...daemons, ...ATTENTE_DAEMONS.filter((d) => inTheme(d.scheme))];

const allSyncProjects = [
  { name: "sync-dark", scheme: "dark", port: SYNC_PORTS.dark.a, after: [] },
  { name: "sync-light", scheme: "light", port: SYNC_PORTS.light.a, after: ["sync-dark"] },
] as const;
const syncProjects = allSyncProjects.filter((p) => inTheme(p.scheme));
const syncNames: readonly string[] = syncProjects.map((p) => p.name);

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
    ...THEMES.filter(inTheme).flatMap(attenteProjects),
    ...syncProjects.map(
      (p): Project => ({
        name: p.name,
        testMatch: /sync\.spec\.ts/,
        dependencies: p.after.filter((name) => syncNames.includes(name)),
        use: { browserName: "chromium", colorScheme: p.scheme, baseURL: `http://127.0.0.1:${p.port}` },
      }),
    ),
  ],
  webServer: [
    ...servers.map(
      (d): WebServer => ({
        command: [
          "bun serve.ts",
          d.port,
          d.scenario,
          "integrations" in d ? "--integrations" : "",
          "noGh" in d ? "--no-gh" : "",
          "design" in d ? "--design" : "",
          "embeds" in d ? "--embeds" : "",
          "drafts" in d ? d.drafts : "",
        ]
          .filter((part) => part !== "")
          .join(" "),
        url: `http://127.0.0.1:${isSiloScenario(d.scenario) ? seedReadyPort(d.port) : d.port}/`,
        reuseExistingServer: false,
        timeout: isSiloScenario(d.scenario) ? 120_000 : 60_000,
        gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
      }),
    ),
    {
      command: "bun serve-sync.ts",
      url: `http://127.0.0.1:${SYNC_PORTS.control}/`,
      reuseExistingServer: false,
      timeout: 120_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
    },
  ],
});
