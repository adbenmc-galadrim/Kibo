import { defineConfig } from "@playwright/test";

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
