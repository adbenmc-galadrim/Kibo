import { defineConfig } from "@playwright/test";

const daemons = [
  { name: "dark", scheme: "dark", port: 4390, spec: /mvp\.spec\.ts/, scenario: "question" },
  { name: "light", scheme: "light", port: 4391, spec: /mvp\.spec\.ts/, scenario: "question" },
  { name: "agents-dark", scheme: "dark", port: 4392, spec: /agents\.spec\.ts/, scenario: "routes" },
  { name: "agents-light", scheme: "light", port: 4393, spec: /agents\.spec\.ts/, scenario: "routes" },
] as const;

export default defineConfig({
  testDir: ".",
  timeout: 30_000,
  use: { trace: "retain-on-failure" },
  projects: daemons.map((d) => ({
    name: d.name,
    testMatch: d.spec,
    use: { browserName: "chromium", colorScheme: d.scheme, baseURL: `http://127.0.0.1:${d.port}` },
  })),
  webServer: daemons.map((d) => ({
    command: `bun serve.ts ${d.port} ${d.scenario}`,
    url: `http://127.0.0.1:${d.port}/`,
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
  })),
});
