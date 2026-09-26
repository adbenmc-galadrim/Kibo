import { afterAll, expect, test } from "bun:test";
import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OsSandbox } from "@kibo/devkit";
import { KiboError } from "@kibo/schema";
import { SERVER_JS, TEST_MANIFEST } from "./backend-code.test-helper";
import { createProcessHost } from "./process-host";

const ESCAPE_JS = `
module.exports.server = {
  actions: {
    escape: async (_ctx, input) => {
      const load = (() => 0).constructor("s", "return import(s)");
      const out = {};
      const attempt = async (name, fn) => { try { await fn(); out[name] = "open"; } catch (e) { out[name] = "blocked"; } };
      const fs = await load("node:fs");
      await attempt("read", () => fs.readFileSync(input.secret, "utf8"));
      const cp = await load("node:child_process");
      await attempt("spawn", () => cp.execFileSync("/bin/sh", ["-c", "exit 0"]));
      await attempt("child", () => cp.execFileSync(process.execPath, ["-e", 'require("node:fs").readFileSync(' + JSON.stringify(input.secret) + ")"], { stdio: "ignore" }));
      const net = await load("node:net");
      await attempt("connect", () => new Promise((ok, ko) => {
        const s = net.connect(input.port, "127.0.0.1");
        s.on("connect", ok);
        s.on("error", ko);
        setTimeout(() => ko(new Error("timeout")), 3000);
      }));
      return out;
    },
  },
};
`;

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
const escapeCall = (input: unknown) => ({
  projectId: "p1",
  instanceId: "i1",
  config: {},
  target: { action: "escape" },
  input,
});

test("a sandboxed backend cannot escape through a constructed import", async () => {
  expect(existsSync("/bin/sh")).toBe(true);
  const secret = realpathSync(mkdtempSync(join(tmpdir(), "kibo-secret-")));
  dirs.push(secret);
  writeFileSync(join(secret, "token"), "s3cret");
  const listener = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("open") });
  const host = createProcessHost({
    ref: "escape@0.1.0",
    manifest: TEST_MANIFEST,
    code: { server: ESCAPE_JS, migrations: null },
    onCall: async () => null,
  });
  try {
    const out = await host.invoke(escapeCall({ secret: join(secret, "token"), port: listener.port }));
    expect(out).toEqual({ read: "blocked", spawn: "blocked", child: "blocked", connect: "blocked" });
  } finally {
    host.stop();
    listener.stop(true);
  }
}, 30_000);

test("without an OS sandbox the backend does not start", async () => {
  const unavailable: OsSandbox = {
    ready: async () => {
      throw new KiboError("SANDBOX_UNAVAILABLE", "bwrap is not installed");
    },
    diagnose: async () => ({
      kind: "bwrap",
      available: false,
      reason: "bwrap is not installed",
      fix: null,
    }),
    wrap: () => [],
  };
  const host = createProcessHost({
    ref: "escape@0.1.0",
    manifest: TEST_MANIFEST,
    code: { server: ESCAPE_JS, migrations: null },
    onCall: async () => null,
    sandbox: unavailable,
  });
  await expect(host.invoke(escapeCall(null))).rejects.toThrow("SANDBOX_UNAVAILABLE");
  expect(host.running).toBe(false);
});

const missing: OsSandbox = {
  ready: async () => {
    throw new KiboError("SANDBOX_UNAVAILABLE", "bubblewrap (bwrap) is not installed");
  },
  diagnose: async () => ({
    kind: "bwrap",
    available: false,
    reason: "bubblewrap (bwrap) is not installed",
    fix: "sudo apt install bubblewrap",
  }),
  wrap: () => {
    throw new Error("an unsandboxed launch must not be wrapped");
  },
};
const capsCall = { projectId: "p1", instanceId: "i1", config: {}, target: { action: "caps" }, input: null };

test("the explicit setting starts the backend without OS isolation, the phase 4 protections stay", async () => {
  const lines: string[] = [];
  const host = createProcessHost({
    ref: "probe@0.1.0",
    manifest: TEST_MANIFEST,
    code: { server: SERVER_JS, migrations: null },
    onCall: async () => null,
    sandbox: missing,
    allowUnsandboxed: () => true,
    log: (l) => lines.push(l),
  });
  try {
    expect(await host.invoke(capsCall)).toBe("undefined,undefined,undefined,undefined");
    expect(host.running).toBe(true);
    expect(lines.some((l) => l.includes("without OS isolation"))).toBe(true);
  } finally {
    host.stop();
  }
}, 30_000);

test("the setting is read at each start: once withdrawn, the backend no longer starts", async () => {
  let allowed = true;
  const host = createProcessHost({
    ref: "probe@0.1.0",
    manifest: TEST_MANIFEST,
    code: { server: SERVER_JS, migrations: null },
    onCall: async () => null,
    sandbox: missing,
    allowUnsandboxed: () => allowed,
  });
  try {
    expect(await host.invoke(capsCall)).toBe("undefined,undefined,undefined,undefined");
    host.stop();
    allowed = false;
    await expect(host.invoke(capsCall)).rejects.toThrow("SANDBOX_UNAVAILABLE");
    expect(host.running).toBe(false);
  } finally {
    host.stop();
  }
}, 30_000);

const LIMITS_JS = `
module.exports.server = {
  actions: {
    ping: async () => "pong",
    huge: async () => "x".repeat(5 * 1024 * 1024),
    flood: async () => {
      const fs = await (() => 0).constructor("s", "return import(s)")("node:fs");
      const chunk = "x".repeat(65536);
      for (let sent = 0; sent < 10 * 1024 * 1024; ) {
        try {
          sent += fs.writeSync(4, chunk);
        } catch (e) {
          if (e.code !== "EAGAIN") throw e;
          await new Promise((r) => setTimeout(r, 1));
        }
      }
      return null;
    },
  },
};
`;
const limits = (log: (line: string) => void = () => undefined) =>
  createProcessHost({
    ref: "limits@0.1.0",
    manifest: TEST_MANIFEST,
    code: { server: LIMITS_JS, migrations: null },
    onCall: async () => null,
    log,
  });
const call = (name: string) => ({
  projectId: "p1",
  instanceId: "i1",
  config: {},
  target: { action: name },
  input: null,
});

test("a result over the limit is refused by the runtime and the backend keeps running", async () => {
  const host = limits();
  try {
    await expect(host.invoke(call("huge"))).rejects.toThrow("TOO_LARGE");
    expect(await host.invoke(call("ping"))).toBe("pong");
  } finally {
    host.stop();
  }
}, 30_000);

test("a backend writing past the limit on its output is killed, the daemon never buffers it", async () => {
  const lines: string[] = [];
  const host = limits((l) => lines.push(l));
  try {
    await expect(host.invoke(call("flood"))).rejects.toThrow("COMPONENT_CRASHED");
    expect(host.running).toBe(false);
    expect(lines.some((l) => l.includes("larger than"))).toBe(true);
  } finally {
    host.stop();
  }
}, 30_000);
