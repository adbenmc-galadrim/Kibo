import { defineConfig, type PlaywrightTestConfig, type Project } from "@playwright/test";
import { MARKET_PORTS } from "./market-fixture";
import { SYNC_PORTS } from "./sync-fixture";

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

const allDaemons = [
  { name: "dark", scheme: "dark", port: 4390, spec: /mvp\.spec\.ts/, scenario: "question" },
  { name: "light", scheme: "light", port: 4391, spec: /mvp\.spec\.ts/, scenario: "question" },
  { name: "agents-dark", scheme: "dark", port: 4392, spec: /agents\.spec\.ts/, scenario: "routes" },
  { name: "agents-light", scheme: "light", port: 4393, spec: /agents\.spec\.ts/, scenario: "routes" },
  { name: "code-dark", scheme: "dark", port: 4394, spec: /code\.spec\.ts/, scenario: "question" },
  { name: "code-light", scheme: "light", port: 4395, spec: /code\.spec\.ts/, scenario: "question" },
  { name: "tabs-dark", scheme: "dark", port: 4396, spec: /tabs\.spec\.ts/, scenario: "question" },
  { name: "tabs-light", scheme: "light", port: 4397, spec: /tabs\.spec\.ts/, scenario: "question" },
  { name: "screens-dark", scheme: "dark", port: 4398, spec: /screens\.spec\.ts/, scenario: "routes" },
  { name: "screens-light", scheme: "light", port: 4399, spec: /screens\.spec\.ts/, scenario: "routes" },
  {
    name: "catalog-dark",
    scheme: "dark",
    port: 4400,
    spec: /catalog\.spec\.ts/,
    scenario: "question",
    drafts: "hello",
  },
  {
    name: "catalog-light",
    scheme: "light",
    port: 4401,
    spec: /catalog\.spec\.ts/,
    scenario: "question",
    drafts: "hello",
  },
  {
    name: "integrations-dark",
    scheme: "dark",
    port: 4402,
    spec: /integrations\.spec\.ts/,
    scenario: "question",
    integrations: true,
  },
  {
    name: "integrations-light",
    scheme: "light",
    port: 4403,
    spec: /integrations\.spec\.ts/,
    scenario: "question",
    integrations: true,
  },
  { name: "ia-dark", scheme: "dark", port: 4404, spec: /ia\.spec\.ts/, scenario: "ai/e2e-routes" },
  { name: "ia-light", scheme: "light", port: 4405, spec: /ia\.spec\.ts/, scenario: "ai/e2e-routes" },
  { name: "menus-dark", scheme: "dark", port: 4415, spec: /menus\.spec\.ts/, scenario: "question" },
  { name: "menus-light", scheme: "light", port: 4416, spec: /menus\.spec\.ts/, scenario: "question" },
  { name: "projects-dark", scheme: "dark", port: 4417, spec: /projects\.spec\.ts/, scenario: "question" },
  { name: "projects-light", scheme: "light", port: 4418, spec: /projects\.spec\.ts/, scenario: "question" },
  { name: "inbox-dark", scheme: "dark", port: 4419, spec: /inbox\.spec\.ts/, scenario: "question" },
  { name: "inbox-light", scheme: "light", port: 4420, spec: /inbox\.spec\.ts/, scenario: "question" },
  { name: "confort-dark", scheme: "dark", port: 4421, spec: /confort\.spec\.ts/, scenario: "question" },
  { name: "confort-light", scheme: "light", port: 4422, spec: /confort\.spec\.ts/, scenario: "question" },
  { name: "layout-dark", scheme: "dark", port: 4423, spec: /layout\.spec\.ts/, scenario: "question" },
  { name: "layout-light", scheme: "light", port: 4424, spec: /layout\.spec\.ts/, scenario: "question" },
  { name: "notes-dark", scheme: "dark", port: 4431, spec: /notes\.spec\.ts/, scenario: "question" },
  { name: "notes-light", scheme: "light", port: 4432, spec: /notes\.spec\.ts/, scenario: "question" },
  {
    name: "creations-dark",
    scheme: "dark",
    port: 4425,
    spec: /creations\.spec\.ts/,
    scenario: "ai/creations-routes",
  },
  {
    name: "creations-light",
    scheme: "light",
    port: 4426,
    spec: /creations\.spec\.ts/,
    scenario: "ai/creations-routes",
  },
  {
    name: "conversation-dark",
    scheme: "dark",
    port: 4427,
    spec: /conversation\.spec\.ts/,
    scenario: "conversation",
  },
  {
    name: "conversation-light",
    scheme: "light",
    port: 4428,
    spec: /conversation\.spec\.ts/,
    scenario: "conversation",
  },
  { name: "widgets-dark", scheme: "dark", port: 4429, spec: /widgets\.spec\.ts/, scenario: "question" },
  { name: "widgets-light", scheme: "light", port: 4430, spec: /widgets\.spec\.ts/, scenario: "question" },
  { name: "graph-dark", scheme: "dark", port: 4433, spec: /graph\.spec\.ts/, scenario: "question" },
  { name: "graph-light", scheme: "light", port: 4434, spec: /graph\.spec\.ts/, scenario: "question" },
  { name: "viewer-dark", scheme: "dark", port: 4437, spec: /viewer\.spec\.ts/, scenario: "question" },
  { name: "viewer-light", scheme: "light", port: 4438, spec: /viewer\.spec\.ts/, scenario: "question" },
  { name: "selection-dark", scheme: "dark", port: 4441, spec: /selection\.spec\.ts/, scenario: "question" },
  { name: "selection-light", scheme: "light", port: 4442, spec: /selection\.spec\.ts/, scenario: "question" },
  {
    name: "files-dark",
    scheme: "dark",
    port: 4435,
    spec: /files\.spec\.ts/,
    scenario: "question",
    drafts: "viewer",
  },
  {
    name: "files-light",
    scheme: "light",
    port: 4436,
    spec: /files\.spec\.ts/,
    scenario: "question",
    drafts: "viewer",
  },
  { name: "game-dark", scheme: "dark", port: 4439, spec: /game\.spec\.ts/, scenario: "question" },
  { name: "game-light", scheme: "light", port: 4440, spec: /game\.spec\.ts/, scenario: "question" },
] as const;
const daemons = allDaemons.filter((d) => inTheme(d.scheme));

const marketThemes = THEMES.filter(inTheme);

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
  use: { trace: "retain-on-failure" },
  projects: [
    ...daemons.map(
      (d): Project => ({
        name: d.name,
        testMatch: d.spec,
        use: { browserName: "chromium", colorScheme: d.scheme, baseURL: `http://127.0.0.1:${d.port}` },
      }),
    ),
    ...marketThemes.map(
      (theme): Project => ({
        name: `market-${theme}`,
        testMatch: /market\.spec\.ts/,
        use: {
          browserName: "chromium",
          colorScheme: theme,
          baseURL: `http://127.0.0.1:${MARKET_PORTS[theme]}`,
        },
      }),
    ),
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
    ...daemons.map(
      (d): WebServer => ({
        command: [
          "bun serve.ts",
          d.port,
          d.scenario,
          "integrations" in d ? "--integrations" : "",
          "drafts" in d ? d.drafts : "",
        ]
          .filter((part) => part !== "")
          .join(" "),
        url: `http://127.0.0.1:${d.port}/`,
        reuseExistingServer: false,
        gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
      }),
    ),
    {
      command: "bun serve-market.ts",
      url: `http://127.0.0.1:${MARKET_PORTS.control}/`,
      reuseExistingServer: false,
      timeout: 120_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
    },
    {
      command: "bun serve-sync.ts",
      url: `http://127.0.0.1:${SYNC_PORTS.control}/`,
      reuseExistingServer: false,
      timeout: 120_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
    },
  ],
});
