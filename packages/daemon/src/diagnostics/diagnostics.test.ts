import { expect, test } from "bun:test";
import type { AppInfo, Environment } from "@kibo/schema";
import { createLogBuffer } from "../log-buffer";
import { createDiagnostics } from "./diagnostics";

const app: AppInfo = {
  version: "1.5.0",
  platform: "darwin",
  arch: "arm64",
  home: "~/.kibo",
  daemonPid: 1,
  uptimeMs: 5,
};
const env: Environment = {
  app,
  daemon: { address: "127.0.0.1:4317", home: "/Users/adam/.kibo" },
  ai: {
    available: true,
    reason: null,
    version: "2.1.283",
    loggedIn: true,
    profiles: { assistant: true, generateur: true },
  },
  git: "2.46",
  gh: null,
  capacity: { cores: 8, ramGb: 16, hostSlots: 3 },
  github: { connected: false },
};

function diagnosticsWith(lines: string[]) {
  const log = createLogBuffer(100);
  const target = { error: (..._args: unknown[]) => undefined, warn: (..._args: unknown[]) => undefined };
  log.install(target);
  for (const line of lines) target.error(line);
  return createDiagnostics({
    appInfo: () => app,
    environment: async () => env,
    counts: () => ({ projects: 2, tickets: 10, components: 7, instances: 4, profiles: 3 }),
    integrations: async () => [{ id: "github", state: "disconnected" }],
    log,
    userHome: "/Users/adam",
  });
}

test("the report abbreviates the home everywhere and keeps the last 50 redacted lines", async () => {
  const lines = Array.from({ length: 60 }, (_, i) => `line ${i} at /Users/adam/.kibo/runs/${i}`);
  const report = await diagnosticsWith(lines)();
  expect(report.log).toHaveLength(50);
  expect(report.log[0]).toBe("error line 10 at ~/.kibo/runs/10");
  expect(report.environment.daemon.home).toBe("~/.kibo");
  expect(JSON.stringify(report)).not.toContain("/Users/adam");
  expect(report.counts.tickets).toBe(10);
  expect(report.integrations).toEqual([{ id: "github", state: "disconnected" }]);
  expect(report.app).toEqual(app);
});

test("a log line with a token, a cookie and a URL with parameters loses them", async () => {
  const report = await diagnosticsWith([
    "[kibo-daemon] pair failed token=abc123 at /Users/adam/.kibo/x",
    "[kibo-daemon] Set-Cookie: kibo_session=s3cr3tvalue; HttpOnly",
    "[kibo-daemon] ready http://127.0.0.1:4317/#pair=f00dcafe",
  ])();
  expect(report.log).toEqual([
    "error [kibo-daemon] pair failed token=[redacted] at ~/.kibo/x",
    "error [kibo-daemon] Set-Cookie: [redacted]",
    "error [kibo-daemon] ready http://127.0.0.1:4317/?[redacted]",
  ]);
  const json = JSON.stringify(report);
  for (const secret of ["abc123", "s3cr3tvalue", "f00dcafe", "/Users/adam"])
    expect(json).not.toContain(secret);
});
