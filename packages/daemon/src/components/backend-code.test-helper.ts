import { ComponentManifest } from "@kibo/schema";

export const TEST_MANIFEST = ComponentManifest.parse({
  id: "probe",
  version: "0.1.0",
  kind: "widget",
  title: "Probe",
  reads: ["ticket"],
  writes: [],
  configVersion: 2,
});

export const SERVER_JS = `
let saved = null;
let running = 0;
let peak = 0;
module.exports.server = {
  actions: {
    ping: async () => "pong",
    caps: async () => [typeof fetch, typeof Bun.file, typeof Bun.spawn, typeof process.binding].join(","),
    tickets: async (ctx) => ctx.list("ticket"),
    save: async (ctx) => { saved = ctx; return null; },
    late: async () => saved.list("ticket"),
    hang: () => new Promise(() => {}),
    crash: async () => { process.exit(3); },
    fail: async () => { const e = new Error("nope"); e.code = "CONFLICT"; e.detail = "nope"; throw e; },
    pid: async () => process.pid,
    wait: async (_ctx, ms) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, ms));
      running -= 1;
      return peak;
    },
    bigint: async () => 1n,
    badCall: async (ctx) => ctx.list("nothing"),
  },
  jobs: { sync: { everyMinutes: 5, run: async () => undefined } },
};
`;

export const MIGRATIONS_JS = `
module.exports.migrations = {
  1: { config: (c) => ({ ...c, v: 1 }) },
  2: { data: (d) => ({ ...d, moved: true }) },
};
`;
