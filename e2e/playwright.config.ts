import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:4390", trace: "retain-on-failure" },
  projects: [
    { name: "dark", use: { browserName: "chromium", colorScheme: "dark" } },
    { name: "light", use: { browserName: "chromium", colorScheme: "light" } },
  ],
  webServer: {
    command: "bun serve.ts",
    url: "http://127.0.0.1:4390/",
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
  },
});
