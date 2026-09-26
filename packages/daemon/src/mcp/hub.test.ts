import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";
import { realpathSync, statSync } from "node:fs";
import { join } from "node:path";
import type { McpServerInput } from "@kibo/schema";
import { createEventLog } from "../integrations/events";
import { createMemorySecretStore, type MemorySecretStore } from "../integrations/memory-secret-store";
import { createRedactor, type Redactor } from "../integrations/redact";
import { createFakeHost, type FakeHost } from "../integrations/testing/fake-host";
import { FAKE_MCP_STDIO, startFakeMcpHttp } from "../testing/fake-mcp";
import { commandLineOf } from "./command-line";
import { createMcpHub, type McpHub } from "./hub";

const http = await startFakeMcpHttp({ bearer: "mcp-bearer-123456" });
const open = await startFakeMcpHttp();
afterAll(async () => {
  await http.stop();
  await open.stop();
});

let host: FakeHost;
let hub: McpHub;
let redactor: Redactor;
let store: MemorySecretStore;
const stdio: McpServerInput = {
  transport: "stdio",
  id: "fake",
  name: "Fake",
  command: process.execPath,
  args: [FAKE_MCP_STDIO],
  envNames: ["FAKE_TOKEN"],
};
const make = (opts: { idleMs?: number; callTimeoutMs?: number } = {}) =>
  createMcpHub({
    host,
    secrets: store,
    events: createEventLog(host.db, redactor, host.now),
    redact: redactor.redact,
    ...opts,
  });
const text = (r: { content: { type: string; text?: string }[] }) =>
  r.content.map((c) => c.text ?? "").join("");

beforeEach(() => {
  host = createFakeHost();
  redactor = createRedactor();
  store = createMemorySecretStore(redactor);
  hub = make();
});
afterEach(async () => {
  await hub.stop();
  host.close();
});

describe("configuration", () => {
  test("refuses a command line the user did not confirm", async () => {
    await expect(hub.add(stdio, "npx something-else", { FAKE_TOKEN: "tok-123456789" })).rejects.toThrow(
      "INVALID_INPUT",
    );
    expect(await hub.views()).toEqual([]);
  });

  test("requires a value for every declared secret variable", async () => {
    await expect(hub.add(stdio, commandLineOf(stdio), {})).rejects.toThrow("INVALID_INPUT");
  });

  test("stores the config locally and the secret in the keychain only", async () => {
    const view = await hub.add(stdio, commandLineOf(stdio), { FAKE_TOKEN: "tok-123456789" });
    expect(view).toMatchObject({ id: "fake", enabled: true, state: "connected", secretsSet: ["FAKE_TOKEN"] });
    expect(view.tools.map((t) => t.name)).toContain("echo");
    expect(await store.get("mcp:fake:FAKE_TOKEN")).toBe("tok-123456789");
    expect(JSON.stringify(host.db.query("SELECT * FROM mcp_servers").all())).not.toContain("tok-123456789");
    expect(JSON.stringify(host.snapshot(host.projectId))).not.toContain("fake");
    await hub.remove("fake");
    expect(await store.get("mcp:fake:FAKE_TOKEN")).toBeNull();
  });
});

describe("stdio", () => {
  test("runs with a reduced env and its own 0700 working directory", async () => {
    await hub.add(stdio, commandLineOf(stdio), { FAKE_TOKEN: "tok-123456789" });
    const out = JSON.parse(text(await hub.call("fake", "env", {}, null)));
    expect(out.keys).toEqual(["FAKE_TOKEN", "HOME", "LANG", "PATH"]);
    expect(out.hasToken).toBe(true);
    const dir = join(host.home, "mcp", "fake");
    expect(out.cwd).toBe(realpathSync(dir));
    expect(statSync(dir).mode & 0o777).toBe(0o700);
  });

  test("logs each call without its arguments", async () => {
    await hub.add(stdio, commandLineOf(stdio), { FAKE_TOKEN: "tok-123456789" });
    expect(text(await hub.call("fake", "echo", { text: "argument-privé" }, "inst-1"))).toBe("argument-privé");
    const fail = await hub.call("fake", "fail", {}, "inst-1");
    expect(fail.isError).toBe(true);
    const rows = host.db.query("SELECT server, tool, instance_id, ok FROM mcp_calls ORDER BY id").all();
    expect(rows).toEqual([
      { server: "fake", tool: "echo", instance_id: "inst-1", ok: 1 },
      { server: "fake", tool: "fail", instance_id: "inst-1", ok: 0 },
    ]);
    expect(JSON.stringify(host.db.query("SELECT * FROM mcp_calls").all())).not.toContain("argument-privé");
  });

  test("times out, truncates, and closes after inactivity", async () => {
    await hub.stop();
    hub = make({ idleMs: 100, callTimeoutMs: 300 });
    await hub.add(stdio, commandLineOf(stdio), { FAKE_TOKEN: "tok-123456789" });
    await expect(hub.call("fake", "slow", { ms: 2_000 }, null)).rejects.toThrow("TIMEOUT");
    const big = await hub.call("fake", "big", { bytes: 2 * 1_048_576 }, null);
    expect(big.truncated).toBe(true);
    expect(text(big).length).toBe(1_048_576);
    await Bun.sleep(250);
    expect((await hub.views())[0]?.state).toBe("idle");
  });

  test("a message larger than the read buffer closes the connection", async () => {
    await hub.add(stdio, commandLineOf(stdio), { FAKE_TOKEN: "tok-123456789" });
    await expect(hub.call("fake", "big", { bytes: 9 * 1_048_576 }, null)).rejects.toThrow("MCP_FAILED");
    expect((await hub.views())[0]?.state).toBe("idle");
    expect(text(await hub.call("fake", "echo", { text: "again" }, null))).toBe("again");
  });

  test("a server error returned to a caller is redacted", async () => {
    await hub.add(stdio, commandLineOf(stdio), { FAKE_TOKEN: "tok-123456789" });
    const failure = await hub.read("fake", "fake://tok-123456789", "inst-1").then(
      () => "resolved",
      (e: unknown) => String(e),
    );
    expect(failure).toContain("MCP_FAILED");
    expect(failure).not.toContain("tok-123456789");
  });

  test("a disabled server cannot be called", async () => {
    await hub.add(stdio, commandLineOf(stdio), { FAKE_TOKEN: "tok-123456789" });
    await hub.setEnabled("fake", false);
    await expect(hub.call("fake", "echo", { text: "x" }, null)).rejects.toThrow("MCP_UNAVAILABLE");
  });
});

describe("http", () => {
  const server = (): McpServerInput => ({
    transport: "http",
    id: "remote",
    name: "Remote",
    url: http.url,
    bearer: true,
  });

  test("sends the bearer from the keychain", async () => {
    const view = await hub.add(server(), commandLineOf(server()), { bearer: "mcp-bearer-123456" });
    expect(view).toMatchObject({ state: "connected", secretsSet: ["bearer"] });
    const res = await hub.read("remote", "fake://items", null);
    expect(text(res)).toContain("Premier");
  });

  test("a wrong bearer is an error state, not a crash", async () => {
    const view = await hub.add(server(), commandLineOf(server()), { bearer: "wrong-bearer-0000" });
    expect(view.state).toBe("error");
    expect(view.error).not.toContain("wrong-bearer-0000");
  });

  test("reserved servers are hidden from the list but callable by the daemon", async () => {
    await hub.setReserved("figma", open.url);
    expect(await hub.views()).toEqual([]);
    expect((await hub.tools("figma")).map((t) => t.name)).toContain("get_metadata");
    await expect(hub.setReserved("figma", "http://10.0.0.2/mcp")).rejects.toThrow("INVALID_INPUT");
    await hub.setReserved("figma", null);
    await expect(hub.tools("figma")).rejects.toThrow("NOT_FOUND");
  });

  test("a reserved server never sends a bearer", async () => {
    await hub.setReserved("figma", http.url);
    await expect(hub.tools("figma")).rejects.toThrow("MCP_UNAVAILABLE");
  });

  test("a loopback server cannot redirect the daemon elsewhere", async () => {
    const hits: string[] = [];
    const target = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch: (req) => {
        hits.push(req.headers.get("authorization") ?? "");
        return new Response("nope", { status: 404 });
      },
    });
    const redirector = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch: () =>
        new Response(null, { status: 307, headers: { location: `http://localhost:${target.port}/mcp` } }),
    });
    try {
      const loop: McpServerInput = {
        transport: "http",
        id: "loop",
        name: "Loop",
        url: `http://127.0.0.1:${redirector.port}/mcp`,
        bearer: true,
      };
      const view = await hub.add(loop, commandLineOf(loop), { bearer: "loop-bearer-secret-123" });
      expect(view.state).toBe("error");
      expect(hits).toEqual([]);
    } finally {
      redirector.stop(true);
      target.stop(true);
    }
  });
});
