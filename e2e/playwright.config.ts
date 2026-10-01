import { defineConfig, type PlaywrightTestConfig, type Project } from "@playwright/test";
import { MARKET_PORTS } from "./market-fixture";
import { SYNC_PORTS } from "./sync-fixture";

const daemons = [
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
] as const;

const marketThemes = ["dark", "light"] as const;

const syncProjects = [
  { name: "sync-dark", scheme: "dark", port: SYNC_PORTS.dark.a, after: [] },
  { name: "sync-light", scheme: "light", port: SYNC_PORTS.light.a, after: ["sync-dark"] },
] as const;

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
        dependencies: [...p.after],
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
